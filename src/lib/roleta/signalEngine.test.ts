import { describe, expect, it } from "vitest";
import { criarSpin } from "./catalogo";
import { detectarSinaisEntrada, evaluateMarketEntropy, isPostZeroQuarantineActive, isZeroInPatternWindow, isSuperGatilho } from "./signalEngine";

const spins = (...numbers: number[]) => numbers.map((n, i) => criarSpin(n, 1_700_000_000_000 + i));

describe("Zero isolation and post-zero quarantine", () => {
  it("detects zero inside the required pattern window", () => {
    expect(isZeroInPatternWindow(spins(1, 2, 0, 4), 4)).toBe(true);
    expect(isZeroInPatternWindow(spins(1, 2, 3, 4), 4)).toBe(false);
  });

  it("keeps signals quarantined for three spins and allows after four clean spins", () => {
    expect(isPostZeroQuarantineActive(spins(1, 2, 0))).toBe(true);
    expect(isPostZeroQuarantineActive(spins(1, 2, 0, 4))).toBe(true);
    expect(isPostZeroQuarantineActive(spins(1, 2, 0, 4, 5, 6))).toBe(false);
    expect(isZeroInPatternWindow(spins(1, 2, 0, 4, 5, 6, 7), 4)).toBe(false);
  });

  it("does not emit VOLT/DELTA while zero remains in the pattern window", () => {
    const history = spins(1, 14, 2, 17, 14, 0, 4, 5, 6);
    const signals = detectarSinaisEntrada(history, {});
    expect(signals.filter((signal) => signal.strategy === "volt-duplo" || signal.strategy === "delta")).toHaveLength(0);
  });
});

describe("Market entropy defensive filter", () => {
  it("allows analysis with fewer than ten spins", () => {
    expect(evaluateMarketEntropy(spins(1, 2, 3, 4, 5)).isMarketSafe).toBe(true);
  });

  it("blocks a dominant sector with six of ten spins and an isolated one-spin break", () => {
    // D1 is dominant with isolated non-D1 breaks between D1 results.
    const result = evaluateMarketEntropy(spins(1, 4, 1, 7, 1, 10, 1, 13, 1, 16));
    expect(result.isMarketSafe).toBe(false);
    expect(result.dominantSector).toBe("DÚZIA D1");
    expect(result.hasIsolatedBreaks).toBe(true);
  });

  it("does not block pure concentration without an isolated break", () => {
    const result = evaluateMarketEntropy(spins(1, 2, 4, 5, 7, 8, 10, 11, 13, 14));
    expect(result.isMarketSafe).toBe(true);
  });
});

describe("VOLT Duplo", () => {
  it("fires after five dominant spins, one break and a return", () => {
    const history = spins(1, 14, 2, 17, 14, 25, 4);
    const signals = detectarSinaisEntrada(history, {});
    expect(signals.some((s) => s.strategy === "volt-duplo" && s.target.includes("D1 + D2"))).toBe(true);
  });

  it("keeps the true dominant column pair after one isolated break instead of pivoting to the break column", () => {
    // C2/C3 dominate; C1 is a single break, then C3 returns.
    const history = spins(2, 3, 5, 6, 8, 1, 3);
    const signals = detectarSinaisEntrada(history, {});
    const volt = signals.find((signal) => signal.strategy === "volt-duplo");
    expect(volt?.target).toBe("COLUNAS C2 + C3");
    expect(volt?.target).not.toBe("COLUNAS C1 + C3");
  });

  it("blocks a return after two break spins", () => {
    const history = spins(1, 14, 2, 17, 14, 25, 26, 4);
    expect(detectarSinaisEntrada(history, {}).some((s) => s.strategy === "volt-duplo")).toBe(false);
  });

  it("does not fire before five dominant spins", () => {
    const history = spins(1, 14, 2, 17, 25, 4);
    expect(detectarSinaisEntrada(history, {}).some((s) => s.strategy === "volt-duplo")).toBe(false);
  });
});

describe("DELTA", () => {
  it("fires after five red spins, one break and a red return", () => {
    const history = spins(1, 3, 5, 7, 9, 2, 12);
    const signals = detectarSinaisEntrada(history, {});
    expect(signals.some((s) => s.strategy === "delta" && s.target === "COR: VERMELHO")).toBe(true);
  });

  it("blocks a return after two breaks for simple chances", () => {
    const history = spins(1, 3, 5, 7, 9, 2, 4, 12);
    expect(detectarSinaisEntrada(history, {}).some((s) => s.strategy === "delta" && s.target === "COR: VERMELHO")).toBe(false);
  });
});

describe("BR Antecedente", () => {
  it("accepts BR when the previous three spins do not fully alternate", () => {
    const history = spins(14, 17, 2, 20);
    const last = history[history.length - 1]!;
    const signals = detectarSinaisEntrada(history, { [last.id]: "rolando" });
    expect(signals.some((s) => s.strategy === "br-antecedente")).toBe(true);
  });

  it("blocks BR after a three-way dozen alternation", () => {
    const history = spins(25, 1, 14, 20);
    const last = history[history.length - 1]!;
    const signals = detectarSinaisEntrada(history, { [last.id]: "rolando" });
    expect(signals.some((s) => s.strategy === "br-antecedente")).toBe(false);
  });

  it("marks VOLT plus BR as one fused super trigger when concurrent", () => {
    const history = spins(1, 14, 2, 17, 14, 25, 4);
    const last = history[history.length - 1]!;
    const signals = detectarSinaisEntrada(history, { [last.id]: "rolando" });
    expect(signals).toHaveLength(1);
    expect(signals[0]?.confluence).toContain("volt-duplo");
    expect(signals[0]?.confluence).toContain("br-antecedente");
    expect(isSuperGatilho(signals)).toBe(true);
  });

  it("prioritizes columns when VOLT dozen and column matrices trigger together", () => {
    // Five spins inside D1/D2 and C1/C2, one D3/C3 break, then return.
    const history = spins(1, 14, 4, 17, 2, 27, 14);
    const signals = detectarSinaisEntrada(history, {});
    expect(signals).toHaveLength(1);
    expect(signals[0]?.strategy).toBe("volt-duplo");
    expect(signals[0]?.target.startsWith("COLUNAS")).toBe(true);
  });
});

describe("Contexto pós-zero", () => {
  it("marca DELTA quando a dominância, a quebra e o retorno acontecem após o último zero", () => {
    const history = spins(0, 1, 3, 5, 7, 9, 2, 12);
    const signals = detectarSinaisEntrada(history, {});
    const delta = signals.find((signal) => signal.strategy === "delta" && signal.target === "COR: VERMELHO");
    expect(delta?.postZeroContext?.distance).toBe(7);
    expect(delta?.postZeroContext?.zeroSpinId).toBe(history[0]?.id);
  });

  it("não confirma um ciclo quando o zero interrompe a sequência de dominância", () => {
    const history = spins(1, 3, 5, 7, 9, 0, 2, 12);
    const signals = detectarSinaisEntrada(history, {});
    const delta = signals.find((signal) => signal.strategy === "delta" && signal.target === "COR: VERMELHO");
    expect(delta).toBeUndefined();
  });

  it("não usa um zero fora da janela de 25 giros", () => {
    const history = spins(0, ...Array.from({ length: 25 }, (_, i) => i % 2 === 0 ? 1 : 2), 1, 3, 5, 7, 9, 2, 12);
    const signals = detectarSinaisEntrada(history, {});
    const delta = signals.find((signal) => signal.strategy === "delta" && signal.target === "COR: VERMELHO");
    expect(delta?.postZeroContext).toBeUndefined();
  });
});
