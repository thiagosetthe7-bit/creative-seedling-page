import { useEffect, useMemo } from "react";
import { detectarSinaisEntrada, isPostZeroQuarantineActive, isSuperGatilho } from "./signalEngine";
import { avaliarSmartGale1 } from "./smartGale";
import { useEstado } from "./store";
import { rebuildSignalTracking, SIGNAL_TRACKING_KEY, type TrackedSignal } from "./signalTracking";
import { loadSessionFinance, saveSessionFinance, type EditableSignalResult } from "./sessionFinance";
import type { Spin } from "./catalogo";

function spinHitsTarget(signal: TrackedSignal, spin: Spin): boolean {
  const strategy = signal.strategy === "bt-concomitante" ? signal.baseStrategy ?? signal.strategy : signal.strategy;
  if (strategy === "volt-duplo") {
    const isDozen = signal.target.startsWith("DÚZIAS");
    const isColumn = signal.target.startsWith("COLUNAS");
    const values = signal.target.split(/\s+/).filter((v) => /^[DC][123]$/.test(v));
    return isDozen ? values.includes(spin.classificacao.duzia) : isColumn ? values.includes(spin.classificacao.coluna) : false;
  }
  if (strategy === "delta") {
    const [category, value] = signal.target.split(":").map((part) => part.trim());
    const key = category === "COR" ? "cor" : category === "P/I" ? "pi" : category === "A/B" ? "ab" : "cavalo";
    return Boolean(value && spin.classificacao[key] === value);
  }
  if (strategy === "br-antecedente") return spin.classificacao.duzia === "D2" || spin.classificacao.coluna === "C2";
  return false;
}

type ExhaustionBlock = { target: string; reason: "WIN" | "FAILED" | "LIMIT" };

function isVoltDelta(signal: TrackedSignal): boolean {
  const strategy = signal.strategy === "bt-concomitante" ? signal.baseStrategy : signal.strategy;
  return strategy === "volt-duplo" || strategy === "delta";
}

function normalizedOutcome(signal: TrackedSignal, corrections: Record<string, string>): "GREEN" | "RED" | "OTHER" {
  const result = corrections[signal.id] ?? signal.result;
  if (result === "GREEN_R1" || result === "GREEN_GALE1") return "GREEN";
  if (result === "RED" || result === "GALE_BLOCKED" || result === "PARTIAL_RED") return "RED";
  return "OTHER";
}

/**
 * Uses only validated signals reconstructed by the engine (not raw short oscillations).
 * A target can form at most twice per session; a second formation requires a GREEN
 * first result and an intervening zero. A first RED/partial-red permanently locks
 * that exact target for the current session.
 */
function exhaustionBlocks(spins: Spin[], tracked: TrackedSignal[], corrections: Record<string, string>): ExhaustionBlock[] {
  if (!spins.length) return [];
  const candidates = tracked.filter(isVoltDelta).slice().sort((a, b) => a.sourceIndex - b.sourceIndex);
  const blocks = new Map<string, ExhaustionBlock>();
  const sourcePosition = new Map(spins.map((spin, index) => [spin.id, index]));

  for (const candidate of candidates) {
    const previous = candidates.filter((item) => item.target === candidate.target && item.sourceIndex < candidate.sourceIndex);
    if (!previous.length) continue;

    const first = previous[0]!;
    const firstOutcome = normalizedOutcome(first, corrections);
    const candidatePosition = sourcePosition.get(candidate.sourceSpinId);
    const firstPosition = sourcePosition.get(first.sourceSpinId);
    const hasZeroReset = candidatePosition !== undefined && firstPosition !== undefined
      && spins.slice(firstPosition + 1, candidatePosition).some((spin) => spin.numero === 0);

    let reason: ExhaustionBlock["reason"] | undefined;
    if (previous.length >= 2) {
      reason = "LIMIT";
    } else if (firstOutcome !== "GREEN") {
      reason = "FAILED";
    } else if (!hasZeroReset) {
      reason = "WIN";
    }

    if (reason) blocks.set(candidate.id, { target: candidate.target, reason });
  }

  // Only block current recommendations; historical formations are used as evidence.
  const latestSpinId = spins[spins.length - 1]!.id;
  return [...blocks.entries()]
    .filter(([signalId]) => candidates.some((signal) => signal.id === signalId && signal.sourceSpinId === latestSpinId))
    .map(([, block]) => block);
}

/** Recalcula sinais e resultados a partir do histórico; persiste o painel sem depender do popup. */
export function useSinais() {
  const estado = useEstado();
  const tracking = useMemo(
    () => rebuildSignalTracking(estado.spins, estado.bips, estado.config.zeroComoProtecao),
    [estado.spins, estado.bips, estado.config.zeroComoProtecao],
  );
  const sinais = useMemo(() => {
    const detected = detectarSinaisEntrada(estado.spins, estado.bips);
    const latestSpin = estado.spins[estado.spins.length - 1];
    if (!latestSpin || latestSpin.numero !== 0 || !estado.config.zeroComoProtecao) return detected;
    const reentries = tracking.signals
      .filter((signal) => signal.sourceSpinId === latestSpin.id && signal.id.includes(":zero-reentry:") && signal.status !== "CONCLUÍDO")
      .map((signal) => ({
        id: signal.id,
        strategy: signal.strategy,
        name: signal.strategyLabel,
        target: signal.target,
        explanation: signal.explanation,
        action: signal.action,
        sourceSpinId: signal.sourceSpinId,
        baseStrategy: signal.baseStrategy,
        confluence: signal.confluence,
      }));
    return [...detected.filter((signal) => !reentries.some((item) => item.id === signal.id)), ...reentries];
  }, [estado.spins, estado.bips, estado.config.zeroComoProtecao, tracking]);
  const marketEntropy = useMemo(() => evaluateMarketEntropy(estado.spins), [estado.spins]);
  const zeroQuarantineActive = useMemo(() => isPostZeroQuarantineActive(estado.spins), [estado.spins]);
  const financeLedger = loadSessionFinance();
  const blockedTargets = useMemo(() => exhaustionBlocks(estado.spins, tracking.signals, financeLedger.corrections), [estado.spins, tracking.signals, financeLedger.corrections]);
  const blockedSignalIds = useMemo(() => new Set(blockedTargets.map((item) => item.target)), [blockedTargets]);
  const sinaisPermitidos = useMemo(() => marketEntropy.isMarketSafe ? sinais.filter((signal) => !blockedSignalIds.has(signal.target)) : sinais.filter((signal) => signal.strategy !== "volt-duplo" && signal.strategy !== "delta"), [sinais, blockedSignalIds, marketEntropy.isMarketSafe]);
  const superGatilho = useMemo(() => isSuperGatilho(sinaisPermitidos), [sinaisPermitidos]);
  const smartGale = useMemo(
    () => avaliarSmartGale1(estado.spins, estado.bips),
    [estado.spins, estado.bips],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SIGNAL_TRACKING_KEY, JSON.stringify(tracking));
    } catch {
      // O painel continua funcional em memória se o armazenamento estiver indisponível.
    }
  }, [tracking]);

  // Automatic settlement is idempotent and never overwrites an operator's manual choice.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ledger = loadSessionFinance();
    let changed = false;
    const corrections = { ...ledger.corrections };
    for (const signal of tracking.signals) {
      if (ledger.removedSignalIds.includes(signal.id)) continue;
      const existing = corrections[signal.id];
      if (existing && existing !== "PENDING") continue;
      let resolved: EditableSignalResult | undefined;
      if (signal.result === "GREEN_R1") resolved = "GREEN_R1";
      else if (signal.result === "GREEN_GALE1") resolved = "GREEN_GALE1";
      else if (signal.result === "RED") resolved = "RED";
      else if (signal.status === "CONCLUÍDO" && signal.result === "NO_SIGNAL" && signal.r1Number !== undefined) {
        // R1 missed and Smart Gale 1 was not approved/executed: record a protective block, not a full RED.
        resolved = "BLOCKED";
      }
      if (resolved && existing !== resolved) {
        corrections[signal.id] = resolved;
        changed = true;
      }
    }
    if (changed) saveSessionFinance({ ...ledger, corrections });
  }, [tracking]);

  return { sinais: zeroQuarantineActive ? [] : sinaisPermitidos, superGatilho: zeroQuarantineActive ? false : superGatilho, smartGale, tracking, blockedTargets, marketEntropy, zeroQuarantineActive };
}
