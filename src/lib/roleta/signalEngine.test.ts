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
    expect(signals.filter((signal) => signal.strategy === "volt-duplo")).toHaveLength(0);
  });
});

describe("Market entropy defensive filter", () => {
  it("allows analysis with fewer than ten spins", () => {
    expect(evaluateMarketEntropy(spins(1, 2, 3, 4, 5)).isMarketSafe).toBe(true);
  });

  it("blocks a dominant sector with six of ten spins and an isolated one-spin break", () => {
    // D1 is dominant with isolated non-D1 breaks between D1 results.
    const result = evaluateMarketEntropy(spins(1, 14, 2, 17, 3, 20, 4, 23, 5, 6));
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
