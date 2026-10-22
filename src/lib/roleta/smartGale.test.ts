import { describe, expect, it } from "vitest";
import { criarSpin } from "./catalogo";
import { avaliarSmartGale1 } from "./smartGale";

const spins = (...numbers: number[]) => numbers.map((n, i) => criarSpin(n, 1_710_000_000_000 + i));

describe("Smart Gale 1 safety rules", () => {
  it("never evaluates or offers a second gale", () => {
    const result = avaliarSmartGale1(spins(1, 14, 2, 17, 14, 25, 4, 26), {});
    expect(result === null || result.galeLevel === 1).toBe(true);
    if (result) expect(result.title).not.toContain("GALE 2");
  });

  it("blocks DELTA after R1 loss without BR confluence", () => {
    // Five reds, two breaks, red return => DELTA signal; R1 then lands black.
    const history = spins(1, 3, 5, 7, 9, 2, 4, 12, 2);
    const result = avaliarSmartGale1(history, {});
    expect(result?.strategy).toBe("delta");
    expect(result?.status).toBe("BLOCKED");
  });

  it("returns only a single decision for the immediately following R1", () => {
    const history = spins(1, 14, 2, 17, 14, 25, 4, 26, 8);
    const result = avaliarSmartGale1(history, {});
    if (result) expect(result.galeLevel).toBe(1);
  });
});
