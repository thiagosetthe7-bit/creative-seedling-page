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
  baseStrategy?: StrategyId | undefined;
  confluence?: StrategyId[] | undefined;
  strategyLabel: string;
  target: string;
  action: string;
  explanation: string;
  postZeroContext?: { zeroSpinId: string; distance: number } | undefined;
  status: SignalStatus;
  result: SignalResult;
  galeReason?: string | undefined;
  r1Number?: number | undefined;
  resolvedNumber?: number | undefined;
  /** Giro exato que encerrou a entrada; usado para evitar dupla contagem. */
  resultSpinId?: string | undefined;
}
export interface SignalTrackingState {
  version: 1;
  lastProcessedSpinId: string | null;
  signals: TrackedSignal[];
}
export const SIGNAL_TRACKING_KEY = "roleta-signal-tracking-v1";
export const EMPTY_SIGNAL_TRACKING: SignalTrackingState = { version: 1, lastProcessedSpinId: null, signals: [] };

function targetHit(signal: Pick<TrackedSignal, "strategy" | "baseStrategy" | "target">, spin: Spin): boolean {
  const strategy = signal.strategy === "bt-concomitante" ? signal.baseStrategy ?? signal.strategy : signal.strategy;
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
function dominantValue(values: string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value || value === "ZERO" || value === "VERDE" || value === "Zero") continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function zeroKeepsCylinderContext(spins: Spin[], zeroIndex: number): boolean {
  const beforeZero = spins.slice(Math.max(0, zeroIndex - 5), zeroIndex);
  if (!beforeZero.length) return false;
  const section = dominantValue(beforeZero.map((spin) => spin.classificacao.secao));
  const axis = dominantValue(beforeZero.map((spin) => spin.classificacao.g010));
  const current = spins[zeroIndex];
  return Boolean(current && (
    (section && current.classificacao.secao === section)
    || (axis && current.classificacao.g010 === axis)
  ));
}

function label(strategy: StrategyId): string {
  return strategy === "volt-duplo" ? "VOLT Duplo" : strategy === "delta" ? "DELTA" : strategy === "br-antecedente" ? "BR Antecedente" : "BT Concomitante";
}
function toTracked(signal: EntrySignal, index: number): TrackedSignal {
  return {
    id: signal.id, sourceSpinId: signal.sourceSpinId, sourceIndex: index + 1,
    strategy: signal.strategy, baseStrategy: signal.baseStrategy, confluence: signal.confluence, strategyLabel: label(signal.strategy), target: signal.target,
    action: signal.action, explanation: signal.explanation, postZeroContext: signal.postZeroContext, status: "AGUARDANDO R1", result: "NO_SIGNAL",
  };
}

/** Deterministic replay lets persisted sessions recover correctly after reload. */
export function rebuildSignalTracking(spins: Spin[], bips: Record<string, TipoBip>, zeroComoProtecao = true): SignalTrackingState {
  if (!spins.length) return EMPTY_SIGNAL_TRACKING;
  const signals: TrackedSignal[] = [];
  for (let index = 0; index < spins.length; index += 1) {
    const current = spins[index]!;
    // Resolve entries from earlier spins before discovering this spin's new signals.
    const zeroReentries: TrackedSignal[] = [];
    for (let s = 0; s < signals.length; s += 1) {
      const tracked = signals[s]!;
      if (tracked.status === "CONCLUÍDO" || tracked.sourceSpinId === current.id) continue;
      const primaryStrategy = tracked.strategy === "bt-concomitante" ? tracked.baseStrategy : tracked.strategy;
      if (zeroComoProtecao && current.numero === 0 && (primaryStrategy === "volt-duplo" || primaryStrategy === "delta")) {
        signals[s] = {
          ...tracked,
          status: "CONCLUÍDO",
          result: tracked.status === "GALE 1 EM ANDAMENTO" ? "GREEN_GALE1" : "GREEN_R1",
          r1Number: tracked.r1Number ?? 0,
          resolvedNumber: 0,
          resultSpinId: current.id,
          galeReason: "ZERO (0) tratado como GREEN/PROTEÇÃO; tendência anterior preservada para reentrada.",
        };
        if (zeroKeepsCylinderContext(spins, index)) {
          zeroReentries.push({
            ...tracked,
            id: tracked.id + ":zero-reentry:" + current.id,
            sourceSpinId: current.id,
            sourceIndex: index + 1,
            explanation: "ZERO (0) tratado como GREEN/PROTEÇÃO. A seção ou o eixo 0/10 mantém alinhamento com o contexto pré-zero; reentrada mantém " + tracked.target + ".",
            action: "REENTRADA APÓS ZERO: MANTER " + tracked.target + " NO PRÓXIMO GIRO.",
            status: "AGUARDANDO R1",
            result: "NO_SIGNAL",
            r1Number: undefined,
            resolvedNumber: undefined,
            resultSpinId: undefined,
            galeReason: undefined,
          });
        }
        continue;
      }
      if (tracked.status === "AGUARDANDO R1") {
        if (targetHit(tracked, current)) {
          signals[s] = { ...tracked, status: "CONCLUÍDO", result: "GREEN_R1", r1Number: current.numero, resolvedNumber: current.numero, resultSpinId: current.id };
        } else {
          const decision = avaliarSmartGale1(spins.slice(0, index + 1), bips);
          const decisionForSignal = decision?.signalId === tracked.id;
          if (decisionForSignal && decision.status === "APPROVED") {
            signals[s] = { ...tracked, status: "GALE 1 EM ANDAMENTO", result: "NO_SIGNAL", r1Number: current.numero, galeReason: decision.reason };
          } else {
            // R1 perdido sem Smart Gale 1 aprovado não é RED financeiro: R2 não foi executado.
            signals[s] = { ...tracked, status: "CONCLUÍDO", result: "NO_SIGNAL", r1Number: current.numero, resolvedNumber: current.numero, galeReason: decision?.reason ?? "R1 não convertido; Gale 1 não aprovado/executado, portanto sem perda financeira." };
          }
        }
      } else if (tracked.status === "GALE 1 EM ANDAMENTO") {
        if (targetHit(tracked, current)) {
          signals[s] = { ...tracked, status: "CONCLUÍDO", result: "GREEN_GALE1", resolvedNumber: current.numero, resultSpinId: current.id };
        } else {
          signals[s] = { ...tracked, status: "CONCLUÍDO", result: "RED", resolvedNumber: current.numero, resultSpinId: current.id };
        }
      }
    }
    for (const reentry of zeroReentries) {
      if (!signals.some((item) => item.id === reentry.id)) signals.push(reentry);
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
