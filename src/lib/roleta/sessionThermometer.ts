import type { Spin } from "./catalogo";
import type { TrackedSignal } from "./signalTracking";

export type SessionTrendStatus = "POSITIVE" | "NEGATIVE";
export interface SessionTrendSnapshot { checkpoint: number; status: SessionTrendStatus; structuralScore: number; hitRate: number | null; resolvedSignals: number; }
export interface SessionTrendAssessment { status: SessionTrendStatus | "CALIBRATING"; checkpoint: number; structuralScore: number; hitRate: number | null; resolvedSignals: number; changedToNegative: boolean; }

function topTwoCoverage(values: string[]): number {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  const sorted = Array.from(counts.values()).sort((a, b) => b - a);
  return values.length ? ((sorted[0] ?? 0) + (sorted[1] ?? 0)) / values.length : 0;
}
function assessAt(spins: Spin[], signals: TrackedSignal[], checkpoint: number): SessionTrendSnapshot {
  const sample = spins.slice(Math.max(0, checkpoint - 20), checkpoint).filter((spin) => spin.numero !== 0);
  const dozenScore = topTwoCoverage(sample.map((spin) => spin.classificacao.duzia));
  const columnScore = topTwoCoverage(sample.map((spin) => spin.classificacao.coluna));
  const structuralScore = (dozenScore + columnScore) / 2;
  const recentSignals = signals.filter((signal) => signal.sourceIndex > Math.max(0, checkpoint - 20) && signal.sourceIndex <= checkpoint && (signal.result === "GREEN_R1" || signal.result === "GREEN_GALE1" || signal.result === "RED"));
  const greens = recentSignals.filter((signal) => signal.result === "GREEN_R1" || signal.result === "GREEN_GALE1").length;
  const hitRate = recentSignals.length ? greens / recentSignals.length : null;
  const accuracyIsWeak = recentSignals.length >= 4 && hitRate !== null && hitRate < 0.5;
  const status: SessionTrendStatus = structuralScore >= 0.75 && !accuracyIsWeak ? "POSITIVE" : "NEGATIVE";
  return { checkpoint, status, structuralScore, hitRate, resolvedSignals: recentSignals.length };
}

/** Avalia no giro 20 e em checkpoints de 10 giros (30, 40, 50...). */
export function assessSessionTrend(spins: Spin[], signals: TrackedSignal[]): SessionTrendAssessment {
  if (spins.length < 20) return { status: "CALIBRATING", checkpoint: 0, structuralScore: 0, hitRate: null, resolvedSignals: 0, changedToNegative: false };
  const checkpoint = spins.length === 20 ? 20 : 20 + Math.floor((spins.length - 20) / 10) * 10;
  const snapshots: SessionTrendSnapshot[] = [];
  for (let point = 20; point <= checkpoint; point += 10) snapshots.push(assessAt(spins, signals, point));
  const current = snapshots[snapshots.length - 1]!;
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2]! : null;
  return { ...current, changedToNegative: previous?.status === "POSITIVE" && current.status === "NEGATIVE" };
}
