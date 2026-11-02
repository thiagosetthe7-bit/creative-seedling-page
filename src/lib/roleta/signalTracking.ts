import type { Spin } from "./catalogo";
import type { TipoBip } from "./store";
import type { EntrySignal, StrategyId } from "./signalEngine";

/** Tipos temporários de compatibilidade; nenhum sinal é reconstruído. */
export type SignalStatus = "AGUARDANDO R1" | "GALE 1 EM ANDAMENTO" | "GALE 1 BLOQUEADO" | "CONCLUÍDO";
export type SignalResult = "GREEN_R1" | "GREEN_GALE1" | "RED" | "GALE_BLOCKED" | "NO_SIGNAL";
export interface TrackedSignal {
  id: string; sourceSpinId: string; sourceIndex: number; strategy: StrategyId;
  strategyLabel: string; target: string; deltaTarget?: string; action: string;
  explanation: string; status: SignalStatus; result: SignalResult; phase: "R1" | "GALE1";
  r1Number?: number; resolvedNumber?: number; resultSpinId?: string; preCatalog?: boolean; blockReason?: string;
}
export interface SignalTrackingState { version: 1; lastProcessedSpinId: string | null; signals: TrackedSignal[]; }
export const SIGNAL_TRACKING_KEY = "roleta-signal-tracking-v1";
export const EMPTY_SIGNAL_TRACKING: SignalTrackingState = { version: 1, lastProcessedSpinId: null, signals: [] };
export function rebuildSignalTracking(_spins: Spin[], _bips: Record<string, TipoBip>, _zeroComoProtecao = true): SignalTrackingState {
  return EMPTY_SIGNAL_TRACKING;
}
export function readSignalTracking(): SignalTrackingState {
  if (typeof window !== "undefined") {
    try { window.localStorage.removeItem(SIGNAL_TRACKING_KEY); } catch { /* storage indisponível */ }
  }
  return EMPTY_SIGNAL_TRACKING;
}
