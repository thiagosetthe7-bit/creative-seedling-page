import { describe, expect, it } from "vitest";
import { analisarBips, detectarNaSequencia, criarSpin } from "./engine";

const seq = (s: string) => s.split(" ");

describe("compatibilidade do detector legado", () => {
  it("A A A A B A gera sinal em A", () => {
    const r = detectarNaSequencia(seq("A A A A B A"), 4);
    expect(r).toHaveLength(1);
    expect(r[0]!.alvo).toBe("A");
    expect(r[0]!.indice).toBe(5);
    expect(r[0]!.sequenciaInicial).toBe(4);
    expect(r[0]!.quebra).toBe("B");
  });

  it("A A A A A B A gera sinal com sequência 5", () => {
    const r = detectarNaSequencia(seq("A A A A A B A"), 4);
    expect(r).toHaveLength(1);
    expect(r[0]!.sequenciaInicial).toBe(5);
  });

  it("A A A B A não gera sinal", () => {
    expect(detectarNaSequencia(seq("A A A B A"), 4)).toHaveLength(0);
  });

  it("A A A A B B A gera sinal", () => {
    const r = detectarNaSequencia(seq("A A A A B B A"), 4);
    expect(r).toHaveLength(1);
    expect(r[0]!.quebraRodadas).toBe(2);
  });
});

describe("BIP ANALYZER", () => {
  it("bloqueia quando a rodada anterior é ZERO e suprime os demais alertas", () => {
    const anterior = criarSpin(0, 1000);
    const atual = criarSpin(17, 2000);
    const sinais = analisarBips([anterior, atual], { [atual.id]: "rolando" });
    expect(sinais).toHaveLength(1);
    expect(sinais[0]!.priority).toBe("CRITICAL");
    expect(sinais[0]!.colorCode).toBe("#343a40");
    expect(sinais[0]!.title).toBe("⛔ PAUSA OPERACIONAL");
    expect(sinais[0]!.message).toContain("ZERO detectado");
  });

  it("BR separado com origem TIER gera entrada única validada pela matriz", () => {
    const anterior = criarSpin(5, 1000); // TIER, SEPARADO, BAIXO
    const atual = criarSpin(20, 2000);
    const sinais = analisarBips([anterior, atual], { [atual.id]: "rolando" });
    expect(sinais).toHaveLength(1);
    expect(sinais[0]!.colorCode).toBe("#28a745");
    expect(sinais[0]!.title).toBe("BR SEPARADO · REPETE ALTURA");
    expect(sinais[0]!.mainAction).toBe("ENTRAR EM BAIXO");
    expect(sinais[0]!.coverageText).toBe("D1+D2");
    expect(sinais[0]!.confidence).toBe(82);
  });

  it("BT com quebra de cor gera inversão validada pela matriz", () => {
    const anterior = criarSpin(17, 1000); // vermelho
    const atual = criarSpin(19, 2000); // vermelho
    const sinais = analisarBips([anterior, atual], { [atual.id]: "timer" });
    expect(sinais).toHaveLength(1);
    expect(sinais[0]!.colorCode).toBe("#dc3545");
    expect(sinais[0]!.title).toBe("BT QUEBRA COR · INVERSÃO");
    expect(sinais[0]!.mainAction).toBe("ENTRAR EM ALTO");
    expect(sinais[0]!.confidence).toBe(78);
  });

  it("Double BT bloqueia e não emite altura, sessão ou validação", () => {
    const anterior = criarSpin(17, 1000);
    const atual = criarSpin(19, 2000);
    const sinais = analisarBips(
      [anterior, atual],
      { [anterior.id]: "timer", [atual.id]: "timer" },
    );
    expect(sinais).toHaveLength(1);
    expect(sinais[0]!.priority).toBe("CRITICAL");
  });
});
