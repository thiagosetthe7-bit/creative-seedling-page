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
    expect(sinais[0]!.confidence).toBe(84);
  });

  it("BT com quebra de cor gera inversão validada pela matriz", () => {
    const anterior = criarSpin(17, 1000); // vermelho
    const atual = criarSpin(19, 2000); // vermelho
    const sinais = analisarBips([anterior, atual], { [atual.id]: "timer" });
    expect(sinais).toHaveLength(1);
    expect(sinais[0]!.colorCode).toBe("#dc3545");
    expect(sinais[0]!.title).toBe("BT QUEBRA COR · INVERSÃO");
    expect(sinais[0]!.mainAction).toBe("ENTRAR EM ALTO");
    expect(sinais[0]!.confidence).toBe(81);
    expect(sinais[0]!.footerNote).toContain("Cor Confirmada");
  });

  it("BR separado com paridade igual eleva confiança para 86%", () => {
    const anterior = criarSpin(5, 1000);
    const atual = criarSpin(7, 2000);
    const sinais = analisarBips([anterior, atual], { [atual.id]: "rolando" });
    expect(sinais[0]!.confidence).toBe(86);
    expect(sinais[0]!.footerNote).toContain("Paridade Confirmada");
  });

  it("padrão não validado não gera pop-up", () => {
    const anterior = criarSpin(17, 1000);
    const atual = criarSpin(18, 2000);
    expect(analisarBips([anterior, atual], { [atual.id]: "rolando" })).toHaveLength(0);
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

describe("BIP ANALYZER v6.0", () => {
  it("estende bloqueio de ZERO por 2 giros coloridos", () => {
    const zero = criarSpin(0, 1000);
    const g1 = criarSpin(17, 2000);
    const g2 = criarSpin(18, 3000);
    const g3 = criarSpin(20, 4000);
    const bips = { [g1.id]: "rolando" as const, [g2.id]: "rolando" as const, [g3.id]: "rolando" as const };
    expect(analisarBips([zero, g1], { [g1.id]: "rolando" })).toHaveLength(1);
    expect(analisarBips([zero, g1, g2], { [g2.id]: "rolando" })[0]!.priority).toBe("CRITICAL");
    expect(analisarBips([zero, g1, g2, g3], bips)[0]!.confidence).toBeGreaterThanOrEqual(78);
  });
});


describe("BIP ANALYZER v6.5", () => {
  it("prioriza 2-2-1 sobre BR/BT", () => {
    const spins=[5,7,20,22,19].map((n,i)=>criarSpin(n,1000+i));
    const sinais=analisarBips(spins,{[spins[4]!.id]:"rolando"});
    expect(sinais[0]!.title).toContain("OSCILAÇÃO 2-2-1");
    expect(sinais[0]!.confidence).toBe(84);
  });
  it("detecta 2-1-1 quando 2-2-1 não existe", () => {
    const spins=[5,7,20,19].map((n,i)=>criarSpin(n,1000+i));
    const sinais=analisarBips(spins,{[spins[3]!.id]:"rolando"});
    expect(sinais[0]!.title).toContain("RETORNO 2-1-1");
    expect(sinais[0]!.confidence).toBe(81);
  });
  it("bloqueia alternância perfeita A-B-A-B", () => {
    const spins=[5,20,7,22,19].map((n,i)=>criarSpin(n,1000+i));
    expect(analisarBips(spins,{[spins[4]!.id]:"rolando"})).toHaveLength(0);
  });
  it("detecta sequência geométrica de 5 dúzias", () => {
    const spins=[1,2,3,4,5,6].map((n,i)=>criarSpin(n,1000+i));
    const sinais=analisarBips(spins,{[spins[5]!.id]:"rolando"});
    expect(sinais[0]!.title).toContain("SEQUÊNCIA GEOMÉTRICA 5x");
    expect(sinais[0]!.confidence).toBe(80);
  });
});
