import type { Spin } from "./catalogo";
import type { TipoBip } from "./store";
import { detectarSinaisEntrada, type EntrySignal, type StrategyId } from "./signalEngine";

export type SignalStatus = "AGUARDANDO R1" | "GALE 1 EM ANDAMENTO" | "CONCLUÍDO";
export type SignalResult = "GREEN_R1" | "GREEN_GALE1" | "RED" | "NO_SIGNAL";
export interface TrackedSignal {
  id: string;
  sourceSpinId: string;
  sourceIndex: number;
  strategy: StrategyId;
  strategyLabel: string;
  target: string;
  deltaTarget?: string;
  action: string;
  explanation: string;
  status: SignalStatus;
  result: SignalResult;
  r1Number?: number;
  resolvedNumber?: number;
  resultSpinId?: string;
}
export interface SignalTrackingState { version: 1; lastProcessedSpinId: string | null; signals: TrackedSignal[]; }
export const SIGNAL_TRACKING_KEY = "roleta-signal-tracking-v1";
export const EMPTY_SIGNAL_TRACKING: SignalTrackingState = { version: 1, lastProcessedSpinId: null, signals: [] };

function singleTargetHit(target: string, spin: Spin): boolean {
  if (spin.numero === 0) return false;
  if (target.startsWith("DÚZIAS")) return target.slice("DÚZIAS".length).split("+").map(v => v.trim()).includes(spin.classificacao.duzia);
  if (target.startsWith("COLUNAS")) return target.slice("COLUNAS".length).split("+").map(v => v.trim()).includes(spin.classificacao.coluna);
  if (target.startsWith("COR ")) return target.slice(4).trim() === spin.classificacao.cor;
  if (target.startsWith("PAR/ÍMPAR ")) return target.slice("PAR/ÍMPAR ".length).trim() === spin.classificacao.pi;
  if (target.startsWith("ALTO/BAIXO ")) return target.slice("ALTO/BAIXO ".length).trim() === spin.classificacao.ab;
  return false;
}
function targetHit(signal: Pick<TrackedSignal, "target" | "deltaTarget">, spin: Spin): boolean {
  return singleTargetHit(signal.target, spin) || (!!signal.deltaTarget && singleTargetHit(signal.deltaTarget, spin));
}
function toTracked(signal: EntrySignal, index: number): TrackedSignal {
  return { id: signal.id, sourceSpinId: signal.sourceSpinId, sourceIndex: index + 1, strategy: signal.strategy, strategyLabel: signal.name, target: signal.target, deltaTarget: signal.deltaTarget, action: signal.action, explanation: signal.explanation, status: "AGUARDANDO R1", result: "NO_SIGNAL" };
}

/** Reproduz o histórico VOLT de forma determinística; resultados além de R1 são corrigidos manualmente no histórico. */
export function rebuildSignalTracking(spins: Spin[], _bips: Record<string, TipoBip>, _zeroComoProtecao = true): SignalTrackingState {
  if (!spins.length) return EMPTY_SIGNAL_TRACKING;
  const signals: TrackedSignal[] = [];
  for (let index = 0; index < spins.length; index += 1) {
    const current = spins[index]!;
    for (let s = 0; s < signals.length; s += 1) {
      const signal = signals[s]!;
      if (signal.status === "CONCLUÍDO" || signal.sourceSpinId === current.id) continue;
      if (targetHit(signal, current)) {
        signals[s] = { ...signal, status: "CONCLUÍDO", result: "GREEN_R1", resolvedNumber: current.numero, resultSpinId: current.id };
      } else if (current.numero === 0) {
        // O zero encerra a janela de observação sem atribuir resultado financeiro automático.
        signals[s] = { ...signal, status: "CONCLUÍDO", result: "NO_SIGNAL", resolvedNumber: 0, resultSpinId: current.id };
      }
    }
    for (const signal of detectarSinaisEntrada(spins.slice(0, index + 1), {})) {
      if (!signals.some((item) => item.id === signal.id)) signals.push(toTracked(signal, index));
    }
  }
  return { version: 1, lastProcessedSpinId: spins[spins.length - 1]!.id, signals };
}
export function readSignalTracking(): SignalTrackingState {
  if (typeof window === "undefined") return EMPTY_SIGNAL_TRACKING;
  try {
    const raw = window.localStorage.getItem(SIGNAL_TRACKING_KEY);
    if (!raw) return EMPTY_SIGNAL_TRACKING;
    const parsed = JSON.parse(raw) as SignalTrackingState;
    return parsed.version === 1 && Array.isArray(parsed.signals) ? parsed : EMPTY_SIGNAL_TRACKING;
  } catch { return EMPTY_SIGNAL_TRACKING; }
}
