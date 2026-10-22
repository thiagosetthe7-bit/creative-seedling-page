import { useEffect, useMemo } from "react";
import { detectarSinaisEntrada, isSuperGatilho } from "./signalEngine";
import { avaliarSmartGale1 } from "./smartGale";
import { useEstado } from "./store";
import { rebuildSignalTracking, SIGNAL_TRACKING_KEY } from "./signalTracking";

/** Recalcula sinais e resultados a partir do histórico; persiste o painel sem depender do popup. */
export function useSinais() {
  const estado = useEstado();
  const sinais = useMemo(
    () => detectarSinaisEntrada(estado.spins, estado.bips),
    [estado.spins, estado.bips],
  );
  const superGatilho = useMemo(() => isSuperGatilho(sinais), [sinais]);
  const smartGale = useMemo(
    () => avaliarSmartGale1(estado.spins, estado.bips),
    [estado.spins, estado.bips],
  );
  const tracking = useMemo(
    () => rebuildSignalTracking(estado.spins, estado.bips),
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

  return { sinais, superGatilho, smartGale, tracking };
}
