import { useEffect, useMemo } from "react";
import { detectarSinaisEntrada, isSuperGatilho } from "./signalEngine";
import { avaliarSmartGale1 } from "./smartGale";
import { useEstado } from "./store";
import { rebuildSignalTracking, SIGNAL_TRACKING_KEY, type TrackedSignal } from "./signalTracking";
import { loadSessionFinance } from "./sessionFinance";
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

function exhaustionBlocks(spins: Spin[], tracked: TrackedSignal[], zeroProtection: boolean, corrections: Record<string, string>): string[] {
  const latest = spins[spins.length - 1];
  if (!latest) return [];
  const blocked: string[] = [];
  for (const failed of tracked) {
    const correctedResult = corrections[failed.id];
    const failedResult = correctedResult === "RED" || correctedResult === "GALE_BLOCKED" || correctedResult === "PARTIAL_RED" || failed.result === "RED";
    if (!failedResult || !failed.resultSpinId) continue;
    const failureIndex = spins.findIndex((spin) => spin.id === failed.resultSpinId);
    if (failureIndex < 0 || failureIndex >= spins.length - 1) continue;
    const after = spins.slice(failureIndex + 1);
    if (zeroProtection && after.some((spin) => spin.numero === 0)) continue;
    // Reset only after a clear break: two consecutive spins outside the failed target.
    let outsideRun = 0;
    let reset = false;
    for (const spin of after) {
      if (spinHitsTarget(failed, spin)) outsideRun = 0;
      else outsideRun += 1;
      if (outsideRun >= 2) { reset = true; break; }
    }
    if (reset) continue;
    if (spinHitsTarget(failed, latest) && !blocked.includes(failed.target)) blocked.push(failed.target);
  }
  return blocked;
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
  const financeLedger = loadSessionFinance();
  const blockedTargets = useMemo(() => exhaustionBlocks(estado.spins, tracking.signals, estado.config.zeroComoProtecao, financeLedger.corrections), [estado.spins, tracking.signals, estado.config.zeroComoProtecao, financeLedger]);
  const sinaisPermitidos = useMemo(() => sinais.filter((signal) => !blockedTargets.includes(signal.target)), [sinais, blockedTargets]);
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

  return { sinais: sinaisPermitidos, superGatilho, smartGale, tracking, blockedTargets };
}
