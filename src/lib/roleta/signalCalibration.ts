import type { Spin } from "./catalogo";
import type { TrackedSignal } from "./signalTracking";
import type { EntrySignal } from "./signalEngine";

export const MASTER_CALIBRATION = {
  version: "12.0-MASTER-PROD",
  totalSignals: 114,
  globalWinRate: 80.7,
  sourceFiles: 54,
  strategyWeights: {
    "volt-b": { label: "VOLT B", winRate: 87.5, greens: 14, reds: 2, sample: 16, weight: 0.875 },
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
  suppressPopups: boolean;
  blockDeltaA: boolean;
}

function getAxisValue(spin: Spin, axis: "cor" | "pi" | "ab"): string {
  if (axis === "cor") return spin.classificacao.cor;
  if (axis === "pi") return spin.classificacao.pi;
  return spin.classificacao.ab;
}
function isCleanAlternation(spins: Spin[], axis: "cor" | "pi" | "ab"): boolean {
  const sample = spins.slice(-6);
  if (sample.length !== 6 || sample.some((spin) => spin.numero === 0)) return false;
  const values = sample.map((spin) => getAxisValue(spin, axis));
  return Boolean(values[0]) && values.every((value, index) => index === 0 || value !== values[index - 1]) &&
    new Set(values).size === 2;
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
  if (spinIndex < 10) return {
    status: "CALIBRANDO", action: "SUPRIMIR_SINAIS",
    diagnostico: "SESSÃO EM CALIBRAÇÃO — filtro de abertura ativo",
    mensagem: "⏳ Mesa em fase de calibração (aguardando 10 giros iniciais).",
    spinIndex, redsConsecutivos: 0, alternatingAxis: null, structuralScore: null,
    suppressPopups: true, blockDeltaA: true,
  };

  let redsConsecutivos = 0;
  const resolved = signals.filter((signal) => signal.result === "RED" || signal.result === "GREEN_R1" || signal.result === "GREEN_GALE1")
    .sort((a, b) => a.sourceIndex - b.sourceIndex);
  for (let i = resolved.length - 1; i >= 0; i--) {
    if (resolved[i]!.result === "RED") redsConsecutivos++;
    else break;
  }

  const alternatingAxis = (["cor", "pi", "ab"] as const).find((axis) => isCleanAlternation(history, axis)) ?? null;
  const structuralScore = structuralConcentration(history);
  if (alternatingAxis) return {
    status: "SESSAO_NEGATIVA", action: "SUPRIMIR_SINAIS",
    diagnostico: "SESSÃO NEGATIVA (Alto ruído / Zigue-zague)",
    mensagem: "⚠️ FILTRO DE RUÍDO: alternância binária curta detetada. Pop-ups temporariamente suspensos.",
    spinIndex, redsConsecutivos, alternatingAxis, structuralScore,
    suppressPopups: true, blockDeltaA: true,
  };
  if (redsConsecutivos >= 2) return {
    status: "DEFESA_ATIVA", action: "BLOQUEAR_DELTA_A",
    diagnostico: "SESSÃO NEGATIVA (Drawdown Defense)",
    mensagem: "🛡️ DEFESA DE BANCA: 2 Reds consecutivos. DELTA A isolado bloqueado; VOLT A/B e confluência permanecem elegíveis.",
    spinIndex, redsConsecutivos, alternatingAxis: null, structuralScore,
    suppressPopups: false, blockDeltaA: true,
  };
  if (structuralScore !== null && structuralScore >= 0.75) return {
    status: "OTIMO", action: "LIBERADO",
    diagnostico: "SESSÃO POSITIVA (Estabilidade estrutural consolidada)",
    mensagem: "✅ Fluxo estrutural consolidado. Sinais elegíveis conforme a calibração.",
    spinIndex, redsConsecutivos, alternatingAxis: null, structuralScore,
    suppressPopups: false, blockDeltaA: false,
  };
  if (structuralScore !== null && structuralScore < 0.5) return {
    status: "SESSAO_NEGATIVA", action: "SUPRIMIR_SINAIS",
    diagnostico: "SESSÃO NEGATIVA (Dispersão estrutural elevada)",
    mensagem: "⚠️ SESSÃO NEGATIVA: dispersão estrutural elevada. Entradas suspensas para proteção.",
    spinIndex, redsConsecutivos, alternatingAxis: null, structuralScore,
    suppressPopups: true, blockDeltaA: true,
  };
  return {
    status: "NEUTRO", action: "LIBERADO",
    diagnostico: "SESSÃO EM OBSERVAÇÃO",
    mensagem: "Sessão em observação; sem bloqueio estrutural confirmado.",
    spinIndex, redsConsecutivos, alternatingAxis: null, structuralScore,
    suppressPopups: false, blockDeltaA: false,
  };
}

export function getMasterStrategyWeight(strategy: EntrySignal["strategy"]): number {
  return MASTER_CALIBRATION.strategyWeights[strategy]?.weight ?? 0.5;
}
export function orderSignalsByMasterWeight<T extends EntrySignal>(signals: T[]): T[] {
  return [...signals].sort((a, b) => getMasterStrategyWeight(b.strategy) - getMasterStrategyWeight(a.strategy));
}
