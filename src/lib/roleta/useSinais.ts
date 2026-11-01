import { useMemo } from "react";
import { detectarSinaisEntrada, isSuperGatilho } from "./signalEngine";
import { useEstado } from "./store";
import type { TrackedSignal } from "./signalTracking";

export function useSinais() {
  const estado = useEstado();
  const sinais = useMemo(
    () => detectarSinaisEntrada(estado.spins, estado.bips),
    [estado.spins, estado.bips],
  );

  // Recria o catálogo de sinais detectados em cada ponto do histórico para alimentar
  // o histórico de sessão. O resultado inicial fica pendente para correção manual.
  const trackedSignals = useMemo<TrackedSignal[]>(() => {
    const byId = new Map<string, TrackedSignal>();
    estado.spins.forEach((spin, index) => {
      const prefix = estado.spins.slice(0, index + 1);
      detectarSinaisEntrada(prefix, estado.bips).forEach((signal) => {
        if (byId.has(signal.id)) return;
        byId.set(signal.id, {
          id: signal.id,
          sourceSpinId: signal.sourceSpinId,
          sourceIndex: index + 1,
          strategy: signal.strategy,
          strategyLabel: signal.name,
          target: signal.target,
          deltaTarget: signal.deltaTarget,
          action: signal.action,
          explanation: signal.explanation,
          status: "CONCLUÍDO",
          result: "NO_SIGNAL",
          phase: "R1",
        });
      });
    });
    return Array.from(byId.values()).sort((a, b) => a.sourceIndex - b.sourceIndex);
  }, [estado.spins, estado.bips]);

  return {
    sinais,
    alertas: sinais,
    superGatilho: isSuperGatilho(sinais),
    smartGale: null,
    tracking: { version: 1 as const, lastProcessedSpinId: estado.spins.at(-1)?.id ?? null, signals: trackedSignals },
    blockedTargets: [],
    marketEntropy: { isMarketSafe: false, dominantSector: null, concentration: 0, hasIsolatedBreaks: false },
    zeroQuarantineActive: false,
    sessionAssessment: { sessionStatus: sinais.length ? "SIGNAL" : "WAITING", sampleSize: estado.spins.length },
  };
}
