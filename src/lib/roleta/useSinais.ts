import { useMemo } from "react";
import { detectarSinaisEntrada, isSuperGatilho } from "./signalEngine";
import { avaliarSmartGale1 } from "./smartGale";
import { useEstado } from "./store";

/** Recalcula sinais e contexto de R1 diretamente do histórico persistido. */
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

  return { sinais, superGatilho, smartGale };
}
