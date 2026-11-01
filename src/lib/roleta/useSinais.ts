import { useEffect } from "react";
import { useEstado } from "./store";
import { EMPTY_SIGNAL_TRACKING, SIGNAL_TRACKING_KEY } from "./signalTracking";

/** Engine desativada até que uma nova especificação seja aprovada. */
export function useSinais() {
  const estado = useEstado();
  useEffect(() => {
    try { window.localStorage.removeItem(SIGNAL_TRACKING_KEY); } catch { /* storage indisponível */ }
  }, []);
  return {
    sinais: [], alertas: [], superGatilho: false, smartGale: null,
    tracking: EMPTY_SIGNAL_TRACKING, blockedTargets: [],
    marketEntropy: { isMarketSafe: false, dominantSector: null, concentration: 0, hasIsolatedBreaks: false },
    zeroQuarantineActive: false,
    sessionAssessment: { sessionStatus: "RESET", sampleSize: estado.spins.length },
  };
}
