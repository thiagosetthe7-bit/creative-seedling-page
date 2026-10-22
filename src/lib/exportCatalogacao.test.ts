import { describe, expect, it } from "vitest";
import { criarSpin } from "./roleta/catalogo";
import { montarCSVCatalogacao } from "./exportCatalogacao";

describe("exportação da catalogação", () => {
  it("exporta o cabeçalho, BOM UTF-8 e zero linhas de dados quando não há giros", () => {
    const csv = montarCSVCatalogacao([], {});
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("GIRO;NUMERO;BT;BR;TERMINAL");
    expect(csv.split("\r\n")).toHaveLength(1);
  });

  it("mantém os giros mais recentes primeiro e registra BT/BR por rodada", () => {
    const antigo = criarSpin(17, 1000);
    const recente = criarSpin(0, 2000);
    const csv = montarCSVCatalogacao(
      [antigo, recente],
      { [antigo.id]: "timer", [recente.id]: "rolando" },
    );
    const linhas = csv.replace(/^\uFEFF/, "").split("\r\n");

    expect(linhas).toHaveLength(3);
    expect(linhas[1]).toContain("1;0;;1;");
    expect(linhas[2]).toContain("2;17;1;;");
  });

  it("não altera a sequência de entrada nem exige os módulos antigos de sinais", () => {
    const spins = [criarSpin(4, 1000), criarSpin(22, 2000)];
    const antes = spins.map((spin) => spin.id);
    montarCSVCatalogacao(spins, {});
    expect(spins.map((spin) => spin.id)).toEqual(antes);
  });
});
