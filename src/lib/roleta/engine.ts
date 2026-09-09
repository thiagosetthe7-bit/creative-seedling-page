/**
 * Motor de detecção de padrões.
 *
 * Regra (não simplificada):
 *  1. Um elemento da categoria aparece N vezes ou mais consecutivas (N = mínimo, padrão 4).
 *  2. Ocorre uma quebra (outro elemento da mesma categoria), que pode durar 1+ rodadas.
 *  3. Quando o elemento original retorna, o sinal é gerado IMEDIATAMENTE nessa rodada.
 *
 * A detecção é determinística: os sinais são sempre recalculados a partir do
 * histórico completo, o que impede alertas duplicados para a mesma ocorrência.
 */

import { CATEGORIAS, classificar, type CategoriaId, type Classificacao } from "./classificacao";

export interface Spin {
  id: string;
  numero: number;
  timestamp: number;
  classificacao: Classificacao;
}

export type StatusSinal = "PENDENTE" | "WIN" | "RED" | "CANCELADO";

export interface Sinal {
  /** ID determinístico: categoria + índice da rodada de retorno */
  id: string;
  categoria: CategoriaId;
  categoriaLabel: string;
  /** elemento recomendado */
  alvo: string;
  sequenciaInicial: number;
  quebra: string;
  quebraRodadas: number;
  retorno: string;
  rodada: number; // 1-based
  spinId: string;
  numero: number;
  timestamp: number;
  /** valor da categoria na rodada seguinte (usado para validação) */
  resultadoSeguinte: string | null;
  numeroSeguinte: number | null;
  status: StatusSinal;
}

export function criarSpin(numero: number, timestamp = Date.now()): Spin {
  return {
    id: `${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    numero,
    timestamp,
    classificacao: classificar(numero),
  };
}

export interface OpcoesDeteccao {
  minimo: number;
  categorias?: CategoriaId[];
}

/** Detecta sinais de UMA categoria sobre uma sequência de valores. */
export function detectarNaSequencia(
  valores: string[],
  minimo: number,
  neutros: string[] = [],
): Array<{
  indice: number;
  alvo: string;
  sequenciaInicial: number;
  quebra: string;
  quebraRodadas: number;
}> {
  const saida: Array<{
    indice: number;
    alvo: string;
    sequenciaInicial: number;
    quebra: string;
    quebraRodadas: number;
  }> = [];

  let runValor: string | null = null;
  let runTam = 0;
  let armado: { alvo: string; sequencia: number; quebra: string; quebraRodadas: number } | null =
    null;

  for (let i = 0; i < valores.length; i++) {
    const v = valores[i]!;

    if (neutros.includes(v)) {
      // Valor neutro (zero): não conta como elemento nem quebra a análise.
      continue;
    }

    if (v === runValor) {
      runTam += 1;
      if (armado) armado.quebraRodadas += 1;
      continue;
    }

    // Mudou de elemento
    if (armado && armado.alvo === v) {
      saida.push({
        indice: i,
        alvo: v,
        sequenciaInicial: armado.sequencia,
        quebra: armado.quebra,
        quebraRodadas: armado.quebraRodadas,
      });
      armado = null;
      runValor = v;
      runTam = 1;
      continue;
    }

    if (armado) armado.quebraRodadas += 1;

    if (runValor !== null && runTam >= minimo) {
      armado = { alvo: runValor, sequencia: runTam, quebra: v, quebraRodadas: 1 };
    }

    runValor = v;
    runTam = 1;
  }

  return saida;
}

/** Detecta todos os sinais de todas as categorias sobre o histórico. */
export function detectarSinais(spins: Spin[], opcoes: OpcoesDeteccao): Sinal[] {
  const ativas = opcoes.categorias;
  const sinais: Sinal[] = [];

  for (const cat of CATEGORIAS) {
    if (ativas && !ativas.includes(cat.id)) continue;
    const valores = spins.map((s) => s.classificacao[cat.id]);
    const encontrados = detectarNaSequencia(valores, opcoes.minimo, cat.neutros ?? []);

    for (const e of encontrados) {
      const spin = spins[e.indice]!;
      const proximo = spins[e.indice + 1] ?? null;
      const resultadoSeguinte = proximo ? proximo.classificacao[cat.id] : null;
      const status: StatusSinal =
        resultadoSeguinte === null ? "PENDENTE" : resultadoSeguinte === e.alvo ? "WIN" : "RED";

      sinais.push({
        id: `${cat.id}#${e.indice}`,
        categoria: cat.id,
        categoriaLabel: cat.label,
        alvo: e.alvo,
        sequenciaInicial: e.sequenciaInicial,
        quebra: e.quebra,
        quebraRodadas: e.quebraRodadas,
        retorno: e.alvo,
        rodada: e.indice + 1,
        spinId: spin.id,
        numero: spin.numero,
        timestamp: spin.timestamp,
        resultadoSeguinte,
        numeroSeguinte: proximo ? proximo.numero : null,
        status,
      });
    }
  }

  return sinais.sort((a, b) => a.rodada - b.rodada || a.categoria.localeCompare(b.categoria));
}

export interface Estatisticas {
  total: number;
  win: number;
  red: number;
  pendentes: number;
  cancelados: number;
  taxaWin: number;
  taxaRed: number;
  maiorSeqWin: number;
  maiorSeqRed: number;
  ultimo: Sinal | null;
}

export function calcularEstatisticas(sinais: Sinal[]): Estatisticas {
  let win = 0;
  let red = 0;
  let pendentes = 0;
  let cancelados = 0;
  let seqWin = 0;
  let seqRed = 0;
  let maiorSeqWin = 0;
  let maiorSeqRed = 0;

  for (const s of sinais) {
    if (s.status === "WIN") {
      win++;
      seqWin++;
      seqRed = 0;
      maiorSeqWin = Math.max(maiorSeqWin, seqWin);
    } else if (s.status === "RED") {
      red++;
      seqRed++;
      seqWin = 0;
      maiorSeqRed = Math.max(maiorSeqRed, seqRed);
    } else if (s.status === "PENDENTE") {
      pendentes++;
    } else {
      cancelados++;
    }
  }

  const resolvidos = win + red;
  return {
    total: sinais.length,
    win,
    red,
    pendentes,
    cancelados,
    taxaWin: resolvidos ? (win / resolvidos) * 100 : 0,
    taxaRed: resolvidos ? (red / resolvidos) * 100 : 0,
    maiorSeqWin,
    maiorSeqRed,
    ultimo: sinais.length ? sinais[sinais.length - 1]! : null,
  };
}
