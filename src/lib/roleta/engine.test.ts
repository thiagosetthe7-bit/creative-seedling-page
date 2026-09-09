import { describe, expect, it } from "vitest";
import { detectarNaSequencia, detectarSinais, criarSpin } from "./engine";
import { classificar } from "./classificacao";

const seq = (s: string) => s.split(" ");

describe("motor da estratégia (mínimo 4)", () => {
  it("TESTE 1: A A A A B A gera sinal em A", () => {
    const r = detectarNaSequencia(seq("A A A A B A"), 4);
    expect(r).toHaveLength(1);
    expect(r[0]!.alvo).toBe("A");
    expect(r[0]!.indice).toBe(5);
    expect(r[0]!.sequenciaInicial).toBe(4);
    expect(r[0]!.quebra).toBe("B");
  });

  it("TESTE 2: A A A A A B A gera sinal com sequência 5", () => {
    const r = detectarNaSequencia(seq("A A A A A B A"), 4);
    expect(r).toHaveLength(1);
    expect(r[0]!.sequenciaInicial).toBe(5);
  });

  it("TESTE 3: A A A B A NÃO gera sinal", () => {
    expect(detectarNaSequencia(seq("A A A B A"), 4)).toHaveLength(0);
  });

  it("TESTE 4: A A A A B B A gera sinal", () => {
    const r = detectarNaSequencia(seq("A A A A B B A"), 4);
    expect(r).toHaveLength(1);
    expect(r[0]!.quebraRodadas).toBe(2);
  });

  it("TESTE 5: A A A A B B NÃO gera sinal", () => {
    expect(detectarNaSequencia(seq("A A A A B B"), 4)).toHaveLength(0);
  });

  it("TESTE 6: A A A A B A A A A C A identifica dois ciclos", () => {
    const r = detectarNaSequencia(seq("A A A A B A A A A C A"), 4);
    expect(r).toHaveLength(2);
    expect(r[0]!.indice).toBe(5);
    expect(r[1]!.indice).toBe(10);
    expect(r[1]!.quebra).toBe("C");
  });

  it("A A A A = ainda não é sinal", () => {
    expect(detectarNaSequencia(seq("A A A A"), 4)).toHaveLength(0);
  });
});

describe("classificação", () => {
  it("classifica conforme a planilha", () => {
    expect(classificar(17)).toMatchObject({
      terminal: "TERM 7",
      cavalo: "1-4-7",
      ab: "BAIXO",
      duzia: "D2",
      coluna: "C2",
      pi: "IMPAR",
      tipo: "JUNTO",
      secao: "ORFÃO",
      g010: "9 VIZINHOS 0",
      g2234: "9 VIZINHOS 34",
      cor: "PRETO",
    });
    expect(classificar(32)).toMatchObject({
      terminal: "TERM 2",
      cavalo: "2-5-8",
      ab: "ALTO",
      duzia: "D3",
      coluna: "C2",
      pi: "PAR",
      tipo: "SEPARADO",
      secao: "ZERO",
      cor: "VERMELHO",
    });
  });
});

describe("TESTE 7: categorias simultâneas", () => {
  it("gera sinais independentes por categoria", () => {
    // 1,3,5,7 = vermelhos ímpares baixos; 2 = quebra; 9 = retorno
    const numeros = [1, 3, 5, 7, 2, 9];
    const spins = numeros.map((n, i) => criarSpin(n, 1000 + i));
    const sinais = detectarSinais(spins, { minimo: 4 });
    const cats = sinais.map((s) => s.categoria);
    expect(cats).toContain("cor");
    expect(cats).toContain("pi");
    expect(sinais.find((s) => s.categoria === "cor")!.alvo).toBe("VERMELHO");
    expect(sinais.find((s) => s.categoria === "pi")!.alvo).toBe("IMPAR");
  });
});
