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
      // O resultado calculado pelo resolver atual é a fonte de verdade.
      // Persistência só complementa um resultado final já resolvido; nunca pode
      // ressuscitar um estado legado "- / AGUARDANDO" sobre um GREEN/RED atual.
      if (persistido && ["GREEN","RED","PARTIAL"].includes(persistido.status) && ["GREEN","RED","PARTIAL"].includes(persistido.outcome)) {
        const outcome = persistido.outcome;
        return { ...s, status: outcome === "GREEN" ? "WIN" : outcome === "PARTIAL" ? "PARTIAL" : "RED", auditResult: outcome, auditNumero: persistido.result, auditTimestamp: persistido.resultTimestamp ?? persistido.recordedAt };
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
