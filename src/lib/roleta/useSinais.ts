import { useEffect, useMemo } from "react";
import { analisarBips, resolverPendentes, calcularEstatisticas, autoTestResolver, type Sinal } from "./engine";
import { acoes, useEstado } from "./store";

export function useSinais() {
  const estado = useEstado();
  const REPROCESS_KEY = "roleta-auditoria-v67-reprocessada";

  const resultado = useMemo(() => {
    const brutos = analisarBips(estado.spins, estado.bips);
    const auditados = resolverPendentes(brutos, estado.spins);
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
    if (typeof window === "undefined") return;
    // W5: pipeline real no boot. O resultado é exposto ao UI sem alterar estratégias.
    const boot = autoTestResolver();
    window.dispatchEvent(new CustomEvent("roleta:self-test", { detail: boot }));
    if (!boot.ok) window.dispatchEvent(new CustomEvent("roleta:resolver-failure", { detail: boot.errors }));


    // Backfill automático: sempre que um próximo giro real já existir, o
    // resultado calculado pelo avaliador único deixa de ser AGUARDANDO.
    // A varredura é idempotente e também corrige registros antigos presos.
    for (const s of resultado.sinais) {
      const persistido = estado.auditoriaLog[s.id];

      if (s.auditResult === "GREEN" || s.auditResult === "RED") {
        if (!persistido || persistido.status === "AGUARDANDO_RESULTADO") {
          acoes.registrarResultadoAutomatico({
            signalId: s.id,
            strategy: s.title,
            entry: s.mainAction,
            result: s.auditNumero ?? 0,
            outcome: s.auditResult,
            status: s.auditResult,
            recordedAt: persistido?.recordedAt ?? Date.now(),
            resultTimestamp: s.auditTimestamp ?? Date.now(),
          });
        }
        continue;
      }

      if (s.auditResult === "NO_BET" && persistido && persistido.status === "AGUARDANDO_RESULTADO") {
        acoes.reprocessarAuditoria({
          signalId: s.id,
          strategy: s.title,
          entry: s.mainAction,
          result: 0,
          outcome: "NO_BET",
          status: "NO_BET",
          recordedAt: persistido.recordedAt,
          resultTimestamp: s.auditTimestamp ?? Date.now(),
        });
      }
    }

    // Sinais novos continuam AGUARDANDO somente quando o próximo giro ainda
    // não foi catalogado.
    const novos = resultado.sinais
      .filter((s) => !estado.auditoriaLog[s.id] && s.auditResult === "AWAITING")
      .map((s) => ({
        signalId: s.id,
        strategy: s.title,
        entry: s.mainAction,
        result: 0,
        outcome: "RED" as const,
        status: "AGUARDANDO_RESULTADO" as const,
        recordedAt: Date.now(),
      }));

    if (novos.length) acoes.registrarAuditorias(novos);
  }, [resultado.sinais, estado.auditoriaLog]);

  return resultado;
}
