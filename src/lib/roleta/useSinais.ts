import { useEffect, useMemo, useState } from "react";
import { analisarBips, calcularEstatisticas, autoTestResolver, type Sinal } from "./engine";
import { aplicarResultados, type Alerta } from "../resolver";
import { acoes, useEstado } from "./store";

const DESFECHOS_FINAIS = new Set(["GREEN_DIRETO", "GREEN_GALE1", "FALHA_GIRO1", "FALHA_GALE"]);

function resultadoFinal(a: Alerta) {
  return a.desfecho === "GREEN_DIRETO" || a.desfecho === "GREEN_GALE1" ? "GREEN" as const : "RED" as const;
}

function eFinal(a: Alerta) {
  return a.desfecho != null && DESFECHOS_FINAIS.has(a.desfecho);
}

export function useSinais() {
  const estado = useEstado();
  const [resolverTick, setResolverTick] = useState(0);

  const resultado = useMemo(() => {
    const brutos = analisarBips(estado.spins, estado.bips);
    const alertasBase: Alerta[] = brutos
      .filter((s) => s.type === "ENTRY_SIGNAL")
      .map((s) => {
        const persistido = estado.auditoriaLog[s.id];
        const finalizado = persistido && ["GREEN", "RED", "PARTIAL"].includes(persistido.status);
        return {
          id: s.id,
          entrada: s.mainAction,
          estrategia: s.title,
          indiceSinal: Math.max(0, (s.rodada || 1) - 1),
          regime: s.regimeClassificado,
          resultado: finalizado ? (persistido!.outcome === "GREEN" ? "GREEN" : "RED") : null,
          numeroResultado: finalizado ? persistido!.result : null,
          numeroGale: null,
          desfecho: null,
          bancaAplicada: Boolean(finalizado),
        };
      });

    const resolvidos = aplicarResultados(alertasBase, estado.spins.map((s) => s.numero));
    const porId = new Map(resolvidos.alertas.map((a) => [a.id, a]));

    const auditados: Sinal[] = brutos.map((s) => {
      const a = porId.get(s.id);
      if (!a) return s;

      if (a.desfecho == null && a.resultado === "RED") {
        return {
          ...s,
          auditResult: "RED",
          auditNumero: a.numeroResultado,
          auditTimestamp: s.timestamp,
          desfechoSequencia: "FALHA_GIRO1",
          gale1Usado: false,
          gale1Resultado: "n/a",
          auditMessage: "Primeiro giro perdido · aguardando GALE 1.",
          auditResultPayload: {
            ...s.auditResultPayload,
            current_number: a.numeroResultado,
            verdict: "RED",
            reason: "Primeiro giro não confirmou a entrada; GALE 1 ainda aguarda o próximo giro.",
            ui_update: { row_color: "#dc3545", badge_text: "❌ RED · aguardando G1…", panel_status: "AWAITING_GALE1" },
          },
        };
      }

      if (!eFinal(a)) return s;

      const final = resultadoFinal(a);
      return {
        ...s,
        auditResult: final,
        auditNumero: a.numeroResultado,
        auditTimestamp: s.timestamp,
        desfechoSequencia: a.desfecho === "FALHA_GALE" ? "FALHA_GALE1" : (a.desfecho ?? "n/a"),
        gale1Usado: a.desfecho === "GREEN_GALE1" || a.desfecho === "FALHA_GALE",
        gale1Resultado: a.desfecho === "GREEN_GALE1" ? "GREEN" : a.desfecho === "FALHA_GALE" ? "RED" : "n/a",
        gale1Stake: a.numeroGale ?? 0,
        auditResultPayload: {
          ...s.auditResultPayload,
          current_number: a.numeroResultado,
          verdict: final,
          reason: final === "GREEN" ? "Resultado confirmado pelo resolver." : "Resultado final confirmado pelo resolver.",
          ui_update: {
            row_color: final === "GREEN" ? "#28a745" : "#dc3545",
            badge_text: final === "GREEN" ? "✅ GREEN" : "❌ RED",
            panel_status: final,
          },
        },
      };
    });

    const sinais: Sinal[] = auditados.map((s) => {
      const persistido = estado.auditoriaLog[s.id];
      if (persistido && ["GREEN", "RED", "PARTIAL"].includes(persistido.status)) {
        const outcome = persistido.outcome === "GREEN" ? "GREEN" : persistido.outcome === "PARTIAL" ? "PARTIAL" : "RED";
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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const boot = autoTestResolver();
    window.dispatchEvent(new CustomEvent("roleta:self-test", { detail: boot }));
    if (!boot.ok) window.dispatchEvent(new CustomEvent("roleta:resolver-failure", { detail: boot.errors }));

    for (const s of resultado.sinais) {
      const persistido = estado.auditoriaLog[s.id];
      const terminal = s.desfechoSequencia === "GREEN_DIRETO" ||
        s.desfechoSequencia === "GREEN_GALE1" ||
        s.desfechoSequencia === "FALHA_GIRO1" ||
        s.desfechoSequencia === "FALHA_GALE1";

      if (terminal && (s.auditResult === "GREEN" || s.auditResult === "RED")) {
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
      } else if (!persistido) {
        acoes.registrarAuditorias([{
          signalId: s.id,
          strategy: s.title,
          entry: s.mainAction,
          result: 0,
          outcome: "AGUARDANDO_RESULTADO",
          status: "AGUARDANDO_RESULTADO",
          recordedAt: Date.now(),
        }]);
      }
    }
  }, [resultado.sinais, estado.auditoriaLog]);

  return resultado;
}
