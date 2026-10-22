import { useMemo } from "react";
import { detectarSinaisEntrada, isSuperGatilho } from "./signalEngine";
import { useEstado } from "./store";

/** Deriva sinais apenas do histórico persistido e do bip marcado na rodada atual. */
export function useSinais() {
  const estado = useEstado();
  const sinais = useMemo(
    () => detectarSinaisEntrada(estado.spins, estado.bips),
    [estado.spins, estado.bips],
  );
  const superGatilho = useMemo(() => isSuperGatilho(sinais), [sinais]);

  return { sinais, superGatilho };
}
