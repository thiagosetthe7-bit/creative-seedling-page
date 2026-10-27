import { describe, expect, it } from "vitest";
import { criarSpin } from "./catalogo";
import { detectarSinaisEntrada, isSuperGatilho } from "./signalEngine";

const spins = (...numbers: number[]) => numbers.map((n, i) => criarSpin(n, 1_700_000_000_000 + i));

describe("VOLT Duplo", () => {
  it("fires after five dominant spins, one break and a return", () => {
    const history = spins(1, 14, 2, 17, 14, 25, 4);
    const signals = detectarSinaisEntrada(history, {});
    expect(signals.some((s) => s.strategy === "volt-duplo" && s.target.includes("D1 + D2"))).toBe(true);
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

  it("não marca pós-zero quando o padrão de dominância começou antes do zero", () => {
    const history = spins(1, 3, 5, 7, 9, 0, 2, 12);
    const signals = detectarSinaisEntrada(history, {});
    const delta = signals.find((signal) => signal.strategy === "delta" && signal.target === "COR: VERMELHO");
    expect(delta?.postZeroContext).toBeUndefined();
  });

  it("não usa um zero fora da janela de 25 giros", () => {
    const history = spins(0, ...Array.from({ length: 25 }, (_, i) => i % 2 === 0 ? 1 : 2), 1, 3, 5, 7, 9, 2, 12);
    const signals = detectarSinaisEntrada(history, {});
    const delta = signals.find((signal) => signal.strategy === "delta" && signal.target === "COR: VERMELHO");
    expect(delta?.postZeroContext).toBeUndefined();
  });
});
