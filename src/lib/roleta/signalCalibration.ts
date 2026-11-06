import type { Spin } from "./catalogo";
import type { TrackedSignal } from "./signalTracking";
import type { EntrySignal } from "./signalEngine";

export const MASTER_CALIBRATION = {
  version: "14.0-MASTER-PROD",
  totalSignals: 115,
  globalWinRate: 80.9,
  sourceSessions: 16,
  strategyWeights: {
    "volt-b": { label: "VOLT B", winRate: 88.2, greens: 15, reds: 2, sample: 17, weight: 0.882 },
    "delta-b": { label: "DELTA B", winRate: 85.7, greens: 6, reds: 1, sample: 7, weight: 0.857 },
    "volt-a": { label: "VOLT A", winRate: 85.5, greens: 47, reds: 8, sample: 55, weight: 0.855 },
    "volt-delta": { label: "CONFLUÊNCIA", winRate: 75, greens: 9, reds: 3, sample: 12, weight: 0.75 },
    "delta-a": { label: "DELTA A", winRate: 66.7, greens: 16, reds: 8, sample: 24, weight: 0.667 },
  },
} as const;

export type MasterSafetyStatus = "CALIBRANDO" | "DEFESA_ATIVA" | "SESSAO_NEGATIVA" | "OTIMO" | "NEUTRO";
export interface MasterSafetyAssessment {
  status: MasterSafetyStatus;
  action: "SUPRIMIR_SINAIS" | "BLOQUEAR_DELTA_A" | "LIBERADO";
  diagnostico: string;
  mensagem: string;
  spinIndex: number;
  redsConsecutivos: number;
  alternatingAxis: string | null;
  structuralScore: number | null;
  structuralAlternationRate: number | null;
  binaryAlternationRate: number | null;
  prioritizeStructural: boolean;
  postVoltGreenFlow: boolean;
  suppressPopups: boolean;
  blockDeltaA: boolean;
}

function getAxisValue(spin: Spin, axis: "cor" | "pi" | "ab"): string {
  if (axis === "cor") return spin.classificacao.cor;
  if (axis === "pi") return spin.classificacao.pi;
  return spin.classificacao.ab;
}
function alternationRate(spins: Spin[], selector: (spin: Spin) => string): number | null {
  const sample = spins.slice(-10).filter((spin) => spin.numero !== 0);
  if (sample.length < 10) return null;
  const values = sample.map(selector);
  const transitions = values.slice(1).filter((value, index) => value !== values[index]).length;
  return transitions / (values.length - 1) * 100;
}
function meanAlternation(spins: Spin[], selectors: ((spin: Spin) => string)[]): number | null {
  const rates = selectors.map((selector) => alternationRate(spins, selector)).filter((rate): rate is number => rate !== null);
  return rates.length ? rates.reduce((sum, n) => sum + n, 0) / rates.length : null;
}
function structuralConcentration(spins: Spin[]): number | null {
  const sample = spins.slice(-10).filter((spin) => spin.numero !== 0);
  if (sample.length < 10) return null;
  const coverage = (values: string[]) => {
    const counts = new Map<string, number>();
    values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
    return Array.from(counts.values()).sort((a, b) => b - a).slice(0, 2).reduce((sum, n) => sum + n, 0) / values.length;
  };
  return (coverage(sample.map((spin) => spin.classificacao.duzia)) +
    coverage(sample.map((spin) => spin.classificacao.coluna))) / 2;
}

export function evaluateMasterSessionSafety(
  spinIndex: number,
  history: Spin[],
  signals: TrackedSignal[],
): MasterSafetyAssessment {
  const structuralAlternationRate = meanAlternation(history, [
    (spin) => spin.classificacao.duzia, (spin) => spin.classificacao.coluna,
  ]);
  const binaryAlternationRate = meanAlternation(history, [
    (spin) => spin.classificacao.cor, (spin) => spin.classificacao.pi, (spin) => spin.classificacao.ab,
  ]);
  const structuralScore = structuralConcentration(history);
  const resolved = signals
    .filter((signal) => signal.result === "RED" || signal.result === "GREEN_R1" || signal.result === "GREEN_GALE1")
    .sort((a, b) => a.sourceIndex - b.sourceIndex);
  let redsConsecutivos = 0;
  for (let i = resolved.length - 1; i >= 0; i--) {
    if (resolved[i]!.result === "RED") redsConsecutivos++;
    else break;
  }
  const lastResolved = resolved.at(-1);
  const postVoltGreenFlow = Boolean(lastResolved && lastResolved.result !== "RED" &&
    (lastResolved.strategy === "volt-a" || lastResolved.strategy === "volt-b" || lastResolved.strategy === "volt-delta") &&
    structuralAlternationRate !== null && structuralAlternationRate < 45);
  const base = {
    spinIndex, redsConsecutivos, alternatingAxis: null as string | null, structuralScore,
    structuralAlternationRate, binaryAlternationRate,
    prioritizeStructural: structuralAlternationRate !== null && structuralAlternationRate < 45,
    postVoltGreenFlow,
  };
  if (spinIndex < 10) return {
    ...base, status: "CALIBRANDO", action: "SUPRIMIR_SINAIS",
    diagnostico: "SESSÃO EM CALIBRAÇÃO — filtro de abertura ativo",
    mensagem: "⏳ Mesa em fase de calibração (aguardando 10 giros iniciais).",
    suppressPopups: true, blockDeltaA: true,
  };
  if (binaryAlternationRate !== null && binaryAlternationRate > 65) return {
    ...base, status: "SESSAO_NEGATIVA", action: "BLOQUEAR_DELTA_A",
    diagnostico: "SESSÃO NEGATIVA (Entropia binária / zigue-zague)",
    mensagem: "⚠️ RUÍDO ELEVADO: alternância binária acima de 65%. DELTA A isolado bloqueado; VOLT A/B continuam elegíveis.",
    suppressPopups: false, blockDeltaA: true,
  };
  if (redsConsecutivos >= 2) return {
    ...base, status: "DEFESA_ATIVA", action: "BLOQUEAR_DELTA_A",
    diagnostico: "SESSÃO NEGATIVA (Drawdown Defense)",
    mensagem: "🛡️ DEFESA DE BANCA: 2 Reds consecutivos. DELTA A isolado bloqueado; VOLT A/B e confluência permanecem elegíveis.",
    suppressPopups: false, blockDeltaA: true,
  };
  if (structuralAlternationRate !== null && structuralAlternationRate < 45) return {
    ...base, status: "OTIMO", action: "LIBERADO",
    diagnostico: "SESSÃO POSITIVA (Inércia setorial consolidada)",
    mensagem: postVoltGreenFlow
      ? "✅ Inércia estrutural após Green VOLT; VOLT A/B recebem prioridade. Indicador descritivo, não previsão do próximo giro."
      : "✅ Baixa alternância estrutural detectada. VOLT A/B recebem prioridade de exibição.",
    suppressPopups: false, blockDeltaA: false,
  };
  if (structuralScore !== null && structuralScore < 0.5) return {
    ...base, status: "SESSAO_NEGATIVA", action: "LIBERADO",
    diagnostico: "SESSÃO NEGATIVA (Dispersão estrutural elevada)",
    mensagem: "⚠️ SESSÃO NEGATIVA: dispersão estrutural elevada. DELTA A permanece sob filtro de ruído.",
    suppressPopups: false, blockDeltaA: true,
  };
  return {
    ...base, status: "NEUTRO", action: "LIBERADO",
    diagnostico: "SESSÃO EM OBSERVAÇÃO",
    mensagem: "Sessão em observação; sem bloqueio estrutural confirmado.",
    suppressPopups: false, blockDeltaA: false,
  };
}

export const OVERLAP_STRATEGY_WEIGHTS: Record<EntrySignal["strategy"], number> = {
  "volt-b": 0.882,
  "delta-b": 0.857,
  "volt-a": 0.855,
  "volt-delta": 0.750,
  "delta-a": 0.652,
};

export interface PrioritizedEntrySignal extends EntrySignal {
  tagVisual: "⭐ RECOMENDADO (MAIOR WR)" | "🛡️ SINAL SECUNDÁRIO / COBERTURA";
  destaque: boolean;
  winRate: string;
}

/** Ordena e anota todos os sinais simultâneos para apresentação no popup dual. */
export function processarSinaisSimultaneos<T extends EntrySignal>(sinaisDetectados: T[], prioritizeStructural = false): (T & {
  tagVisual: PrioritizedEntrySignal["tagVisual"];
  destaque: boolean;
  winRate: string;
})[] {
  const isStructural = (strategy: EntrySignal["strategy"]) => strategy === "volt-a" || strategy === "volt-b";
  const sinaisOrdenados = [...sinaisDetectados].sort((a, b) => {
    if (prioritizeStructural && isStructural(a.strategy) !== isStructural(b.strategy)) return isStructural(a.strategy) ? -1 : 1;
    return (OVERLAP_STRATEGY_WEIGHTS[b.strategy] ?? 0.5) - (OVERLAP_STRATEGY_WEIGHTS[a.strategy] ?? 0.5);
  });
  return sinaisOrdenados.map((sinal, index) => ({
    ...sinal,
    tagVisual: index === 0 ? "⭐ RECOMENDADO (MAIOR WR)" : "🛡️ SINAL SECUNDÁRIO / COBERTURA",
    destaque: index === 0,
    priorityOverride: prioritizeStructural && isStructural(sinal.strategy),
    winRate: `${((OVERLAP_STRATEGY_WEIGHTS[sinal.strategy] ?? 0.5) * 100).toFixed(1)}%`,
  }));
}

export function getMasterStrategyWeight(strategy: EntrySignal["strategy"]): number {
  return OVERLAP_STRATEGY_WEIGHTS[strategy] ?? 0.5;
}
export function orderSignalsByMasterWeight<T extends EntrySignal>(signals: T[]): T[] {
  return processarSinaisSimultaneos(signals);
}
