import { useEffect, useMemo } from "react";
import { detectarSinaisEntrada, isSuperGatilho } from "./signalEngine";
import { avaliarSmartGale1 } from "./smartGale";
import { useEstado } from "./store";
import { rebuildSignalTracking, SIGNAL_TRACKING_KEY } from "./signalTracking";

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
  const superGatilho = useMemo(() => isSuperGatilho(sinais), [sinais]);
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

  return { sinais, superGatilho, smartGale, tracking };
}
