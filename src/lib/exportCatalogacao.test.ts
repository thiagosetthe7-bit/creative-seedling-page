import { describe, expect, it } from "vitest";
import { criarSpin } from "./roleta/catalogo";
import { montarCSVCatalogacao } from "./exportCatalogacao";

describe("exportação da catalogação", () => {
  it("exporta cabeçalho completo, BOM UTF-8 e sem linhas quando não há giros", () => {
    const csv = montarCSVCatalogacao([], {});
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Spin_Index;Timestamp;Number;Terminal;Cavalo;High_Low;Dozen;Column;Even_Odd;Type;Section;Axis_0_10;Axis_22_34;Color;Triggered_Strategy;Target_Bet;Signal_Source_Spin_Index;Signal_Status;Execution_Mode;Financial_Impact;Running_Bankroll");
    expect(csv.split("\r\n")).toHaveLength(1);
  });

  it("mantém ordem cronológica e registra flags BR/BT por giro", () => {
    const antigo = criarSpin(17, 1000);
    const recente = criarSpin(0, 2000);
    const csv = montarCSVCatalogacao(
      [antigo, recente],
      { [antigo.id]: "timer", [recente.id]: "rolando" },
    );
    const linhas = csv.replace(/^\uFEFF/, "").split("\r\n");
    const antiga = linhas[1]!.split(";");
    const nova = linhas[2]!.split(";");

    expect(linhas).toHaveLength(3);
    expect(antiga[0]).toBe("1");
    expect(antiga[1]).toBe("17");
    expect(antiga[13]).toBe("0");
    expect(antiga[14]).toBe("1");
    expect(nova[0]).toBe("2");
    expect(nova[1]).toBe("0");
    expect(nova[13]).toBe("1");
    expect(nova[14]).toBe("0");
    expect(antiga).toHaveLength(21);
    expect(antiga[17]).toBe("NO_SIGNAL");\n    expect(antiga[18]).toBe("Monitoramento");\n    expect(antiga[19]).toBe("0.00");\n    expect(antiga[20]).toBe("100.00");
  });

  it("não altera a sequência de entrada nem exige os módulos antigos de sinais", () => {
    const spins = [criarSpin(4, 1000), criarSpin(22, 2000)];
    const antes = spins.map((spin) => spin.id);
    montarCSVCatalogacao(spins, {});
    expect(spins.map((spin) => spin.id)).toEqual(antes);
  });
  it("registra cada sinal na linha de origem, inclusive pendente e pré-catalogação", () => {
    const spins = Array.from({ length: 22 }, (_, index) => criarSpin(index % 36 + 1, (index + 1) * 1000));
    const sourceSpin = spins[7]!;
    const preCatalogSpin = spins[10]!;
    const signals = [
      {
        id: "signal-pending", sourceSpinId: sourceSpin.id, sourceIndex: 8,
        strategy: "volt-a" as const, strategyLabel: "VOLT A", target: "COLUNAS C1 + C2",
        action: "R1", explanation: "", status: "AGUARDANDO R1" as const,
        result: "NO_SIGNAL" as const, phase: "R1" as const,
      },
      {
        id: "signal-pre-green", sourceSpinId: preCatalogSpin.id, sourceIndex: 11,
        strategy: "delta-a" as const, strategyLabel: "DELTA A", target: "COR: VERMELHO",
        action: "R1", explanation: "", status: "CONCLUÍDO" as const,
        result: "GREEN_GALE1" as const, phase: "GALE1" as const, preCatalog: true,
      },
    ];
    const lines = montarCSVCatalogacao(spins, {}, signals).replace(/^\\uFEFF/, "").split("\\r\\n");
    const row8 = lines[8]!.split(";");
    const row11 = lines[11]!.split(";");
    expect(row8[14]).toBe("VOLT A");
    expect(row8[15]).toBe("COLUNAS C1 + C2");
    expect(row8[17]).toBe("Pendente");
    expect(row11[14]).toBe("DELTA A");
    expect(row11[17]).toBe("Pré-Catalogação • Green");\n    expect(row11[18]).toBe("Monitoramento");
  });

});
