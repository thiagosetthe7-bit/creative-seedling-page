import type { Spin } from "./catalogo";
import type { TipoBip } from "./store";
import { detectarSinaisEntrada, type EntrySignal, type StrategyId } from "./signalEngine";
import { avaliarSmartGale1 } from "./smartGale";

export type SignalStatus = "AGUARDANDO R1" | "GALE 1 EM ANDAMENTO" | "CONCLUÍDO";
export type SignalResult = "GREEN_R1" | "GREEN_GALE1" | "RED" | "NO_SIGNAL";
export interface TrackedSignal {
  id: string;
  sourceSpinId: string;
  sourceIndex: number;
  strategy: StrategyId;
  baseStrategy?: StrategyId;
  strategyLabel: string;
  target: string;
  action: string;
  explanation: string;
  status: SignalStatus;
  result: SignalResult;
  galeReason?: string;
  r1Number?: number;
  resolvedNumber?: number;
}
export interface SignalTrackingState {
  version: 1;
  lastProcessedSpinId: string | null;
  signals: TrackedSignal[];
}
export const SIGNAL_TRACKING_KEY = "roleta-signal-tracking-v1";
export const EMPTY_SIGNAL_TRACKING: SignalTrackingState = { version: 1, lastProcessedSpinId: null, signals: [] };

function targetHit(signal: Pick<TrackedSignal, "strategy" | "target">, spin: Spin): boolean {
  const strategy = signal.strategy;
  if (strategy === "volt-duplo" || strategy === "bt-concomitante") {
    const base = signal.target.startsWith("DÚZIAS") ? "duzia" : signal.target.startsWith("COLUNAS") ? "coluna" : null;
    if (base === "duzia") return signal.target.slice("DÚZIAS".length).split("+").map(v => v.trim()).includes(spin.classificacao.duzia);
    if (base === "coluna") return signal.target.slice("COLUNAS".length).split("+").map(v => v.trim()).includes(spin.classificacao.coluna);
  }
  if (strategy === "br-antecedente") return spin.classificacao.duzia === "D2" || spin.classificacao.coluna === "C2";
  if (strategy === "delta") {
    const separator = signal.target.indexOf(":");
    if (separator < 0) return false;
    const category = signal.target.slice(0, separator).trim();
    const value = signal.target.slice(separator + 1).trim();
    const key = category === "COR" ? "cor" : category === "P/I" ? "pi" : category === "A/B" ? "ab" : "cavalo";
    return spin.classificacao[key] === value;
  }
  return false;
}
function label(strategy: StrategyId): string {
  return strategy === "volt-duplo" ? "VOLT Duplo" : strategy === "delta" ? "DELTA" : strategy === "br-antecedente" ? "BR Antecedente" : "BT Concomitante";
}
function toTracked(signal: EntrySignal, index: number): TrackedSignal {
  return {
    id: signal.id, sourceSpinId: signal.sourceSpinId, sourceIndex: index + 1,
    strategy: signal.strategy, baseStrategy: signal.baseStrategy, strategyLabel: label(signal.strategy), target: signal.target,
    action: signal.action, explanation: signal.explanation, status: "AGUARDANDO R1", result: "NO_SIGNAL",
  };
}

/** Deterministic replay lets persisted sessions recover correctly after reload. */
export function rebuildSignalTracking(spins: Spin[], bips: Record<string, TipoBip>): SignalTrackingState {
  if (!spins.length) return EMPTY_SIGNAL_TRACKING;
  const signals: TrackedSignal[] = [];
  for (let index = 0; index < spins.length; index += 1) {
    const current = spins[index]!;
    // Resolve entries from earlier spins before discovering this spin's new signals.
    for (let s = 0; s < signals.length; s += 1) {
      const tracked = signals[s]!;
      if (tracked.status === "CONCLUÍDO" || tracked.sourceSpinId === current.id) continue;
      if (tracked.status === "AGUARDANDO R1") {
        if (targetHit(tracked, current)) {
          signals[s] = { ...tracked, status: "CONCLUÍDO", result: "GREEN_R1", r1Number: current.numero, resolvedNumber: current.numero };
        } else {
          const decision = avaliarSmartGale1(spins.slice(0, index + 1), bips);
          const decisionForSignal = decision?.signalId === tracked.id;
          if (decisionForSignal && decision.status === "APPROVED") {
            signals[s] = { ...tracked, status: "GALE 1 EM ANDAMENTO", result: "NO_SIGNAL", r1Number: current.numero, galeReason: decision.reason };
          } else {
            signals[s] = { ...tracked, status: "CONCLUÍDO", result: "RED", r1Number: current.numero, resolvedNumber: current.numero, galeReason: decision?.reason };
          }
        }
      } else if (tracked.status === "GALE 1 EM ANDAMENTO") {
        if (targetHit(tracked, current)) {
          signals[s] = { ...tracked, status: "CONCLUÍDO", result: "GREEN_GALE1", resolvedNumber: current.numero };
        } else {
          signals[s] = { ...tracked, status: "CONCLUÍDO", result: "RED", resolvedNumber: current.numero };
        }
      }
    }
    const found = detectarSinaisEntrada(spins.slice(0, index + 1), bips);
    for (const signal of found) {
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
    if (parsed.version !== 1 || !Array.isArray(parsed.signals)) return EMPTY_SIGNAL_TRACKING;
    return parsed;
  } catch {
    return EMPTY_SIGNAL_TRACKING;
  }
}
