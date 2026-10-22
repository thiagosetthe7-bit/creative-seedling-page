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
  it("fires after five red spins, two breaks and a red return", () => {
    const history = spins(1, 3, 5, 7, 9, 2, 4, 12);
    const signals = detectarSinaisEntrada(history, {});
    expect(signals.some((s) => s.strategy === "delta" && s.target === "COR: VERMELHO")).toBe(true);
  });

  it("blocks a return after three break spins", () => {
    const history = spins(1, 3, 5, 7, 9, 2, 4, 6, 12);
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

  it("marks VOLT plus BR as a super trigger when concurrent", () => {
    const history = spins(1, 14, 2, 17, 3, 25, 4);
    const last = history[history.length - 1]!;
    const signals = detectarSinaisEntrada(history, { [last.id]: "rolando" });
    expect(isSuperGatilho(signals)).toBe(true);
  });
});
