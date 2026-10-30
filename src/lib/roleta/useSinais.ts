import { useMemo } from "react";
import { detectarSinaisEntrada, isSuperGatilho } from "./signalEngine";
import { useEstado } from "./store";
import { rebuildSignalTracking, SIGNAL_TRACKING_KEY } from "./signalTracking";

/**
 * Adaptador de compatibilidade: o motor está desativado e não emite sinais.
 * Mantém apenas a estrutura do histórico legado; não aplica estratégias,
 * filtros de sessão, bloqueios, exaustão, delay ou regras de gale.
 */
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

  return {
    sinais,
    superGatilho: isSuperGatilho(sinais),
    smartGale: null,
    tracking,
    blockedTargets: [],
    marketEntropy: { isMarketSafe: true, dominantSector: null, concentration: 0, hasIsolatedBreaks: false },
    zeroQuarantineActive: false,
    sessionAssessment: { sessionStatus: "OPEN", sampleSize: estado.spins.length },
  };
}
