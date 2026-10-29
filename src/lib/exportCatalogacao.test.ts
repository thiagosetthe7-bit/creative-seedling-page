import { describe, expect, it } from "vitest";
import { criarSpin } from "./roleta/catalogo";
import { montarCSVCatalogacao } from "./exportCatalogacao";
import type { TrackedSignal } from "./roleta/signalTracking";

describe("exportação da catalogação", () => {
  it("exporta cabeçalho com as 21 colunas, BOM UTF-8 e sem linhas quando não há giros", () => {
    const csv = montarCSVCatalogacao([], {});
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Spin_Index;Number;Terminal;Cavalo;High_Low;Dozen;Column;Even_Odd;Type;Section;Axis_0_10;Axis_22_34;Color;BR_Flag;BT_Flag;Triggered_Strategy;Target_Bet;Signal_Result;Post_Zero_Context;Last_Zero_Distance_Spins;Last_Zero_Spin_ID;Gale_Bloqueado");
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
    expect(antiga).toHaveLength(22);
    expect(antiga[21]).toBe("Não");
  });

  it("registra o resultado no giro que resolveu o sinal, sem duplicar a recomendação", () => {
    const source = criarSpin(1, 1000);
    const resolution = criarSpin(14, 2000);
    const tracked: TrackedSignal = {
      id: "signal-1",
      sourceSpinId: source.id,
      sourceIndex: 1,
      strategy: "br-antecedente",
      strategyLabel: "BR Antecedente",
      target: "DÚZIA D2 + COLUNA C2",
      action: "Alvo",
      explanation: "Teste",
      status: "CONCLUÍDO",
      result: "GREEN_GALE1",
      resolvedNumber: 14,
      resultSpinId: resolution.id,
    };
    const csv = montarCSVCatalogacao([source, resolution], {}, [tracked]).replace(/^\uFEFF/, "").split("\r\n");
    const sourceRow = csv[1]!.split(";");
    const resolutionRow = csv[2]!.split(";");
    expect(sourceRow[15]).toBe("BR");
    expect(sourceRow[16]).toBe("DÚZIA D2 + COLUNA C2");
    expect(sourceRow[17]).toBe("NO_SIGNAL");
    expect(resolutionRow[17]).toBe("GREEN_GALE1");
    const auditedCsv = montarCSVCatalogacao([source, resolution], {}, [tracked], { "signal-1": "GALE_BLOCKED" }).replace(/^\uFEFF/, "").split("\r\n");
    expect(auditedCsv[1]!.split(";")[21]).toBe("TRUE");
    expect(auditedCsv[1]!.split(";")[17]).toBe("GREEN_GALE1");
  });

  it("não altera a sequência de entrada nem exige os módulos antigos de sinais", () => {
    const spins = [criarSpin(4, 1000), criarSpin(22, 2000)];
    const antes = spins.map((spin) => spin.id);
    montarCSVCatalogacao(spins, {});
    expect(spins.map((spin) => spin.id)).toEqual(antes);
  });
});
