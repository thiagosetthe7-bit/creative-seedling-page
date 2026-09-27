import { useEffect, useMemo, useState } from "react";
import { analisarBips, calcularEstatisticas, autoTestResolver, type Sinal } from "./engine";
import { aplicarResultados, type Alerta } from "../resolver";
import { acoes, useEstado } from "./store";

export function useSinais() {
  const estado = useEstado();
  const [resolverTick, setResolverTick] = useState(0);

  const resultado = useMemo(() => {
    const brutos = analisarBips(estado.spins, estado.bips);
    const alertasBase: Alerta[] = brutos
      .filter((s) => s.type === "ENTRY_SIGNAL")
      .map((s) => ({
        id: s.id,
        entrada: s.mainAction,
        estrategia: s.title,
        indiceSinal: Math.max(0, (s.rodada || 1) - 1),
        regime: s.regimeClassificado,
        resultado: null,
        numeroResultado: null,
        numeroGale: null,
        desfecho: null,
        bancaAplicada: Boolean(estado.auditoriaLog[s.id] && ["GREEN","RED","PARTIAL"].includes(estado.auditoriaLog[s.id]!.status)),
      }));
    const resolvidos = aplicarResultados(alertasBase, estado.spins.map((s) => s.numero), estado.banca.unidade);
    const porId = new Map(resolvidos.alertas.map((a) => [a.id, a]));
    const auditados = brutos.map((s) => {
      const a = porId.get(s.id);
      if (!a || a.desfecho == null) return s;
      const resultado = a.resultado === "GREEN" && a.desfecho === "GREEN_DIRETO" ? "GREEN" :
        a.desfecho === "GREEN_GALE1" ? "GREEN" : "RED";
      return {
        ...s,
        auditResult: resultado as Sinal["auditResult"],
        auditNumero: a.numeroResultado,
        auditTimestamp: Date.now(),
        desfechoSequencia: a.desfecho === "FALHA_GIRO1" ? "FALHA_GIRO1" : a.desfecho === "FALHA_GALE" ? "FALHA_GALE1" : a.desfecho,
        gale1Usado: a.desfecho === "GREEN_GALE1" || a.desfecho === "FALHA_GALE",
        gale1Resultado: a.desfecho === "GREEN_GALE1" ? "GREEN" : a.desfecho === "FALHA_GALE" ? "RED" : "n/a",
      };
    });

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
      deltaBancaResolvido: resolvidos.delta,
    };
  }, [estado, resolverTick]);

  // Aplica o delta de banca somente uma vez: o auditoriaLog persistido funciona como idempotência.
  useEffect(() => {
    if (resultado.deltaBancaResolvido) {
      acoes.atualizarBanca({ unidade: estado.banca.unidade + resultado.deltaBancaResolvido });
    }
  }, [resultado.deltaBancaResolvido, estado.banca.unidade]);

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
