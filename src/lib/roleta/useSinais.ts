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
    for (const s of resultado.sinais) {
      const existente = estado.auditoriaLog[s.id];
      if (existente && existente.status !== "AGUARDANDO_RESULTADO") continue;

      if (s.auditSpinId && s.auditNumero !== null && (s.auditResult === "GREEN" || s.auditResult === "RED" || s.auditResult === "PARTIAL")) {
        acoes.registrarResultadoAutomatico({
          signalId: s.id,
          strategy: s.title,
          entry: s.mainAction,
          result: s.auditNumero,
          outcome: s.auditResult,
          status: s.auditResult,
          recordedAt: existente?.recordedAt ?? Date.now(),
          resultTimestamp: s.auditTimestamp ?? Date.now(),
        });
      } else if (!existente) {
        acoes.registrarAuditorias([{
          signalId: s.id,
          strategy: s.title,
          entry: s.mainAction,
          result: 0,
          outcome: "DADO_PERDIDO",
          status: "AGUARDANDO_RESULTADO",
          recordedAt: Date.now(),
        }]);
      }
    }
  }, [resultado.sinais, estado.auditoriaLog]);

  return resultado;
}
