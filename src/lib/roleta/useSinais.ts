import { useMemo } from "react";
import { analisarBips, auditarSinais, calcularEstatisticas, type Sinal } from "./engine";
import { useEstado } from "./store";

export function useSinais() {
  const estado = useEstado();

  return useMemo(() => {
    const brutos = analisarBips(estado.spins, estado.bips);
    const auditados = auditarSinais(brutos, estado.spins);
    const sinais: Sinal[] = auditados.map((s) =>
      estado.cancelados.includes(s.id) ? { ...s, status: "CANCELADO" } : s,
    );

    return {
      sinais,
      estatisticas: calcularEstatisticas(sinais),
      naoVistos: sinais.filter((s) => !estado.vistos.includes(s.id)),
      confirmados: estado.confirmados,
    };
  }, [estado]);
}
