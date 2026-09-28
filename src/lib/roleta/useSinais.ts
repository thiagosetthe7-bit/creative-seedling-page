import { useEffect, useMemo, useState } from "react";
import { analisarBips, calcularEstatisticas, autoTestResolver, type Sinal } from "./engine";
import { computarDesfecho, type AlertaBase } from "../resolver";
import { autoTestPadroes } from "../padroes";
import { acoes, useEstado } from "./store";

const DESFECHOS_FINAIS = new Set(["GREEN_DIRETO", "GREEN_GALE1", "FALHA_GIRO1", "FALHA_GALE"]);

export function useSinais() {
  const estado = useEstado();
  const [resolverTick, setResolverTick] = useState(0);

  const resultado = useMemo(() => {
    const brutos = analisarBips(estado.spins, estado.bips);
    const catalogacao = estado.spins.map((s) => s.numero);
    const porId = new Map<string, ReturnType<typeof computarDesfecho>>();

    for (const s of brutos.filter((x) => x.type === "ENTRY_SIGNAL")) {
      const alerta: AlertaBase = {
        id: s.id,
        entrada: s.mainAction,
        estrategia: s.title,
        indiceSinal: Math.max(0, (s.rodada || 1) - 1),
        regime: s.regimeClassificado,
      };
      porId.set(s.id, computarDesfecho(alerta, catalogacao));
    }

    const sinais: Sinal[] = brutos.map((s) => {
      const r = porId.get(s.id);
      if (!r) return s;
      if (r.desfecho == null && r.resultado === "RED") {
        return {
          ...s, auditResult: "RED", auditNumero: r.numeroResultado, auditTimestamp: s.timestamp,
          desfechoSequencia: "n/a", gale1Usado: false, gale1Resultado: "n/a",
          auditMessage: "Primeiro giro perdido · aguardando GALE 1.",
        };
      }
      if (!r.desfecho || !["GREEN_DIRETO","GREEN_GALE1","FALHA_GIRO1","FALHA_GALE"].includes(r.desfecho)) return s;
      const final = r.desfecho === "GREEN_DIRETO" || r.desfecho === "GREEN_GALE1" ? "GREEN" as const : "RED" as const;
      return {
        ...s,
        auditResult: final,
        auditNumero: r.numeroResultado,
        auditTimestamp: s.timestamp,
        desfechoSequencia: r.desfecho === "FALHA_GALE" ? "FALHA_GALE1" : r.desfecho,
        gale1Usado: r.desfecho === "GREEN_GALE1" || r.desfecho === "FALHA_GALE",
        gale1Resultado: r.desfecho === "GREEN_GALE1" ? "GREEN" : r.desfecho === "FALHA_GALE" ? "RED" : "n/a",
        auditResultPayload: {
          ...s.auditResultPayload,
          current_number: r.numeroResultado,
          verdict: final,
          reason: "Resultado confirmado pelo resolver.",
          ui_update: { row_color: final === "GREEN" ? "#28a745" : "#dc3545", badge_text: final === "GREEN" ? "✅ GREEN" : "❌ RED", panel_status: final },
        },
      };
    });

    const persistidos = sinais.map((s) => {
      const p = estado.auditoriaLog[s.id];
      if (!p || !["GREEN","RED","PARTIAL"].includes(p.status)) return s;
      const outcome = p.outcome === "GREEN" ? "GREEN" : p.outcome === "PARTIAL" ? "PARTIAL" : "RED";
      return { ...s, status: outcome === "GREEN" ? "WIN" : outcome === "PARTIAL" ? "PARTIAL" : "RED", auditResult: outcome, auditNumero: p.result, auditTimestamp: p.resultTimestamp ?? p.recordedAt };
    });

    return { sinais: persistidos, estatisticas: calcularEstatisticas(persistidos), naoVistos: persistidos.filter((s) => !estado.vistos.includes(s.id)), confirmados: estado.confirmados };
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
    const padroesBoot = autoTestPadroes();
    const combinedBoot = { ok: boot.ok && padroesBoot.ok, errors: [...boot.errors, ...padroesBoot.errors] };
    window.dispatchEvent(new CustomEvent("roleta:self-test", { detail: combinedBoot }));
    if (!combinedBoot.ok) window.dispatchEvent(new CustomEvent("roleta:resolver-failure", { detail: combinedBoot.errors }));

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
