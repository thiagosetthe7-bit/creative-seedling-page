import { useEffect, useMemo, useState } from "react";
import { analisarBips, resolverPendentes, calcularEstatisticas, autoTestResolver, type Sinal } from "./engine";
import { acoes, useEstado } from "./store";

export function useSinais() {
  const estado = useEstado();
  const [resolverTick, setResolverTick] = useState(0);

  const resultado = useMemo(() => {
    const brutos = analisarBips(estado.spins, estado.bips);
    const auditados = resolverPendentes(brutos, estado.spins);

    const sinais: Sinal[] = auditados.map((s) => {
      const persistido = estado.auditoriaLog[s.id];

      // O resolver atual é a fonte de verdade. Um registro legado pendente
      // nunca pode mascarar um GREEN/RED já calculado para o próximo giro.
      if (persistido && ["GREEN", "RED", "PARTIAL"].includes(persistido.status) &&
          ["GREEN", "RED", "PARTIAL"].includes(persistido.outcome)) {
        const outcome = persistido.outcome;
        return {
          ...s,
          status: outcome === "GREEN" ? "WIN" : outcome === "PARTIAL" ? "PARTIAL" : "RED",
          auditResult: outcome,
          auditNumero: persistido.result,
          auditTimestamp: persistido.resultTimestamp ?? persistido.recordedAt,
        };
      }

      return s;
    });

    return {
      sinais,
      estatisticas: calcularEstatisticas(sinais),
      naoVistos: sinais.filter((s) => !estado.vistos.includes(s.id)),
      confirmados: estado.confirmados,
    };
  }, [estado, resolverTick]);

  // Reprocessa no boot, após cada nova catalogação, após override e após reprocessamento.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const rerun = () => setResolverTick((v) => v + 1);
    window.addEventListener("roleta:catalogo-atualizado", rerun);
    window.addEventListener("roleta:resolver-run", rerun);
    return () => {
      window.removeEventListener("roleta:catalogo-atualizado", rerun);
      window.removeEventListener("roleta:resolver-run", rerun);
    };
  }, []);

  // Boot: self-test real + backfill idempotente do histórico.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const boot = autoTestResolver();
    window.dispatchEvent(new CustomEvent("roleta:self-test", { detail: boot }));
    if (!boot.ok) window.dispatchEvent(new CustomEvent("roleta:resolver-failure", { detail: boot.errors }));

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
      } else if (s.auditResult === "AWAITING" && !persistido) {
        acoes.registrarAuditorias([{
          signalId: s.id,
          strategy: s.title,
          entry: s.mainAction,
          result: 0,
          // Pending is represented only by status; the outcome is not a result.
          outcome: "RED",
          status: "AGUARDANDO_RESULTADO",
          recordedAt: Date.now(),
        }]);
      }
    }
  }, [resultado.sinais, estado.auditoriaLog]);

  return resultado;
}
