import { describe, expect, it } from "vitest";
import { criarSpin } from "./roleta/catalogo";
import { montarCSVCatalogacao } from "./exportCatalogacao";

describe("exportação independente da catalogação", () => {
  it("exporta cabeçalho, BOM UTF-8 e catálogo vazio", () => {
    const csv = montarCSVCatalogacao([], {});
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Spin_Index;Timestamp;Number;Terminal;Cavalo;High_Low;Dozen;Column;Even_Odd;Type;Section;Axis_0_10;Axis_22_34;Color;Bip");
    expect(csv.split("\r\n")).toHaveLength(1);
  });
  it("exporta giros cronológicos e marcações BT/BR sem qualquer módulo de estratégia", () => {
    const first = criarSpin(17, 1000);
    const second = criarSpin(0, 2000);
    const csv = montarCSVCatalogacao([first, second], { [first.id]: "timer", [second.id]: "rolando" });
    const rows = csv.replace(/^\uFEFF/, "").split("\r\n");
    expect(rows).toHaveLength(3);
    expect(rows[1]).toContain("1;1970-01-01T00:00:01.000Z;17;");
    expect(rows[1]?.endsWith(";BT")).toBe(true);
    expect(rows[2]).toContain("2;1970-01-01T00:00:02.000Z;0;");
    expect(rows[2]?.endsWith(";rolando")).toBe(true);
  });
  it("não altera a sequência de entrada", () => {
    const spins = [criarSpin(4, 1000), criarSpin(22, 2000)];
    const before = spins.map((spin) => spin.id);
    montarCSVCatalogacao(spins, {});
    expect(spins.map((spin) => spin.id)).toEqual(before);
  });
});
