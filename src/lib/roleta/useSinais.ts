import { useMemo } from "react";
import { detectarSinaisEntrada, isSuperGatilho, type EntrySignal } from "./signalEngine";
import { useEstado } from "./store";
import { rebuildSignalTracking } from "./signalTracking";

/** Integra exclusivamente o motor VOLT Puro e reconstrói o histórico financeiro. */
export function useSinais() {
  const estado = useEstado();
  const tracking = useMemo(
    () => rebuildSignalTracking(estado.spins, estado.bips, estado.config.zeroComoProtecao),
    [estado.spins, estado.bips, estado.config.zeroComoProtecao],
  );
  const sinais = useMemo(
    () => detectarSinaisEntrada(estado.spins, estado.bips),
    [estado.spins, estado.bips],
  );

  const alertas = useMemo<EntrySignal[]>(() => tracking.signals
    .filter((signal) => signal.status !== "CONCLUÍDO")
    .sort((a, b) => ({ R1: 0, GALE1: 1, GALE2: 2 }[a.phase] - { R1: 0, GALE1: 1, GALE2: 2 }[b.phase]) || a.sourceIndex - b.sourceIndex)
    .map((signal) => ({
      id: `${signal.id}:${signal.phase}`,
      strategy: signal.strategy,
      name: signal.phase === "GALE1" ? "VOLT - GALE 1" : signal.phase === "GALE2" ? "VOLT - GALE 2" : signal.strategyLabel,
      target: signal.target,
      explanation: signal.explanation,
      action: signal.phase === "R1" ? signal.action : `Recuperação ${signal.phase === "GALE1" ? "Gale 1" : "Gale 2"}: manter o alvo identificado no próximo giro.`,
      sourceSpinId: signal.sourceSpinId,
      phase: signal.phase,
    })), [tracking]);

  return {
    sinais,
    alertas,
    superGatilho: isSuperGatilho(sinais),
    smartGale: null,
    tracking,
    blockedTargets: [],
    marketEntropy: { isMarketSafe: true, dominantSector: null, concentration: 0, hasIsolatedBreaks: false },
    zeroQuarantineActive: false,
    sessionAssessment: { sessionStatus: "OPEN", sampleSize: estado.spins.length },
  };
}
