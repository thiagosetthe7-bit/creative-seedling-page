import { useMemo } from "react";
import { detectarSinaisEntrada, isSuperGatilho } from "./signalEngine";
import { useEstado } from "./store";

export function useSinais() {
  const estado = useEstado();
  const sinais = useMemo(
    () => detectarSinaisEntrada(estado.spins, estado.bips),
    [estado.spins, estado.bips],
  );
  return {
    sinais,
    alertas: sinais,
    superGatilho: isSuperGatilho(sinais),
    smartGale: null,
    tracking: { version: 1 as const, lastProcessedSpinId: estado.spins.at(-1)?.id ?? null, signals: [] },
    blockedTargets: [],
    marketEntropy: { isMarketSafe: false, dominantSector: null, concentration: 0, hasIsolatedBreaks: false },
    zeroQuarantineActive: false,
    sessionAssessment: { sessionStatus: sinais.length ? "SIGNAL" : "WAITING", sampleSize: estado.spins.length },
  };
}
