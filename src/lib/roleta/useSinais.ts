import { useEffect, useMemo } from "react";
import { analisarBips, auditarSinais, calcularEstatisticas, type Sinal } from "./engine";
import { acoes, useEstado } from "./store";

export function useSinais() {
  const estado = useEstado();
  const REPROCESS_KEY = "roleta-auditoria-v67-reprocessada";

  const resultado = useMemo(() => {
    const brutos = analisarBips(estado.spins, estado.bips);
    const auditados = auditarSinais(brutos, estado.spins);
    const sinais: Sinal[] = auditados.map((s) => {
      const persistido = estado.auditoriaLog[s.id];
      if (persistido && persistido.status !== "AGUARDANDO_RESULTADO") {
        const outcome = persistido.outcome === "DADO_PERDIDO" || persistido.outcome === "NO_BET" ? "CANCELADO" : persistido.outcome;
        return { ...s, status: outcome === "GREEN" ? "WIN" : outcome === "PARTIAL" ? "PARTIAL" : "RED", auditResult: outcome === "CANCELADO" ? "NO_BET" : outcome, auditNumero: persistido.result, auditTimestamp: persistido.resultTimestamp ?? persistido.recordedAt };
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
    if (typeof window !== "undefined" && !window.localStorage.getItem(REPROCESS_KEY)) {
      const historico = Object.values(estado.auditoriaLog);
      for (const s of resultado.sinais) {
        const antigo = estado.auditoriaLog[s.id];
        if (!antigo) continue;
        if (s.auditResult === "GREEN" || s.auditResult === "RED") {
          acoes.reprocessarAuditoria({
            signalId: s.id,
            strategy: s.title,
            entry: s.mainAction,
            result: s.auditNumero ?? antigo.result,
            outcome: s.auditResult,
            status: s.auditResult,
            recordedAt: antigo.recordedAt,
            resultTimestamp: s.auditTimestamp ?? antigo.resultTimestamp,
          });
        } else if (s.auditResult === "NO_BET" && (antigo.outcome === "GREEN" || antigo.outcome === "RED" || antigo.outcome === "DADO_PERDIDO")) {
          acoes.reprocessarAuditoria({
            signalId: s.id,
            strategy: s.title,
            entry: s.mainAction,
            result: 0,
            outcome: "NO_BET",
            status: "NO_BET",
            recordedAt: antigo.recordedAt,
            resultTimestamp: s.auditTimestamp ?? antigo.resultTimestamp,
          });
        }
      }
      window.localStorage.setItem(REPROCESS_KEY, "1");
      void historico;
    }

    for (const s of resultado.sinais) {
      const existente = estado.auditoriaLog[s.id];
      if (existente && existente.status !== "AGUARDANDO_RESULTADO") continue;

      if (s.auditResult === "NO_BET") {
        continue;
      } else if (!existente) {
        acoes.registrarAuditorias([{
          signalId: s.id,
          strategy: s.title,
          entry: s.mainAction,
          result: 0,
          outcome: "RED",
          status: "AGUARDANDO_RESULTADO",
          recordedAt: Date.now(),
        }]);
      }
    }
  }, [resultado.sinais, estado.auditoriaLog]);

  return resultado;
}
