import { useEffect, useMemo } from "react";
import { analisarBips, auditarSinais, calcularEstatisticas, type Sinal } from "./engine";
import { acoes, useEstado } from "./store";

export function useSinais() {
  const estado = useEstado();

  const resultado = useMemo(() => {
    const brutos = analisarBips(estado.spins, estado.bips);
    const auditados = auditarSinais(brutos, estado.spins);
    const sinais: Sinal[] = auditados.map((s) => {
      const persistido = estado.auditoriaLog[s.id];
      if (persistido && persistido.status !== "AGUARDANDO_RESULTADO") {
        return { ...s, status: persistido.outcome === "GREEN" ? "WIN" : persistido.outcome === "RED" ? "RED" : persistido.outcome === "PARTIAL" ? "PARTIAL" : "CANCELADO", auditResult: persistido.outcome === "DADO_PERDIDO" ? "NEUTRAL" : persistido.outcome, auditNumero: persistido.result, auditTimestamp: persistido.resultTimestamp ?? persistido.recordedAt };
      }
      if (estado.cancelados.includes(s.id)) return { ...s, status: "CANCELADO" };
      return s;
    });

    return {
      sinais,
      estatisticas: calcularEstatisticas(sinais),
      naoVistos: sinais.filter((s) => !estado.vistos.includes(s.id)),
      confirmados: estado.confirmados,
    };
  }, [estado]);

  useEffect(() => {
    const registros = resultado.sinais
      .filter((s) => s.auditSpinId && s.auditNumero !== null && (s.auditResult === "GREEN" || s.auditResult === "RED" || s.auditResult === "PARTIAL"))
      .filter((s) => !estado.auditoriaLog[s.id])
      .map((s) => ({
        signalId: s.id,
        strategy: s.title,
        entry: s.mainAction,
        result: s.auditNumero as number,
        outcome: s.auditResult as "GREEN" | "RED" | "PARTIAL",
        status: "AGUARDANDO_RESULTADO",
        recordedAt: s.auditTimestamp ?? Date.now(),
      }));
    if (registros.length) acoes.registrarAuditorias(registros);
  }, [resultado.sinais, estado.auditoriaLog]);

  return resultado;
}
