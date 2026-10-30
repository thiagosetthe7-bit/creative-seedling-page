import type { Spin } from "./catalogo";

export type SessionStatus = "OPEN" | "CLOSED" | "TRANSITION";
export interface SessionAssessment {
  sessionStatus: SessionStatus;
  sampleSize: number;
  repeatedAreaTransitions: number;
  message: string;
}

/**
 * Avalia uma amostra recente de 30 a 50 giros.
 * Conta transições consecutivas em que a coluna OU a dúzia se repetiu.
 * Zero interrompe a continuidade e não é contado como área repetida.
 */
export function evaluateSession(spins: Spin[]): SessionAssessment {
  const sample = spins.slice(-50);
  if (sample.length < 30) {
    return {
      sessionStatus: "TRANSITION",
      sampleSize: sample.length,
      repeatedAreaTransitions: 0,
      message: "Amostragem insuficiente: registre ou importe ao menos 30 giros para avaliar a sessão.",
    };
  }

  let repeatedAreaTransitions = 0;
  for (let i = 1; i < sample.length; i += 1) {
    const previous = sample[i - 1]!;
    const current = sample[i]!;
    if (previous.numero === 0 || current.numero === 0) continue;
    const sameColumn = Boolean(current.classificacao.coluna)
      && current.classificacao.coluna === previous.classificacao.coluna;
    const sameDozen = Boolean(current.classificacao.duzia)
      && current.classificacao.duzia === previous.classificacao.duzia;
    if (sameColumn || sameDozen) repeatedAreaTransitions += 1;
  }

  if (repeatedAreaTransitions === 0 || repeatedAreaTransitions >= 8) {
    return {
      sessionStatus: "CLOSED",
      sampleSize: sample.length,
      repeatedAreaTransitions,
      message: "⚠️ SESSÃO FECHADA: Mesa em dispersão caótica ou saturação extrema. Aguarde ruptura ou troque de mesa.",
    };
  }
  if (repeatedAreaTransitions >= 1 && repeatedAreaTransitions <= 5) {
    return {
      sessionStatus: "OPEN",
      sampleSize: sample.length,
      repeatedAreaTransitions,
      message: "🟢 SESSÃO ABERTA: Inércia de fluxo saudável. Sinais VOLT/DELTA liberados.",
    };
  }
  return {
    sessionStatus: "TRANSITION",
    sampleSize: sample.length,
    repeatedAreaTransitions,
    message: "🟡 SESSÃO EM OBSERVAÇÃO: padrão estrutural intermediário (6–7 repetições).",
  };
}
