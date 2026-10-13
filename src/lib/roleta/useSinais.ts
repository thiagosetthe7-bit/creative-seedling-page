import { useEffect, useMemo, useState } from "react";
import { analisarBips, calcularEstatisticas, autoTestResolver, autoTestRegimeV14, type Sinal } from "./engine";
import { computarDesfecho, autoTestResolverV14, type AlertaBase } from "../resolver";
import { autoTestPadroes } from "../padroes";
import { rodarSelfTest } from "../avaliador";
import { useEstado } from "./store";

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
        observacao: s.observacaoHostil,
        padrao: s.footerNote || s.sequenceContext || s.title,
      };
      porId.set(s.id, computarDesfecho(alerta, catalogacao));
    }

    const sinais: Sinal[] = brutos.map((s) => {
      const r = porId.get(s.id);
      if (!r) return s;
      if (r.desfecho === "PAUSA") {
        return { ...s, status: "CANCELADO", auditResult: "NO_BET", auditNumero: r.n1, galeNumero: r.n2 ?? null, desfechoSequencia: "PAUSA", auditMessage: "ZERO · PAUSA (fora da contagem)", auditResultPayload: { ...s.auditResultPayload, current_number: 0, verdict: "NO_BET", reason: "Zero é pausa e não entra no denominador.", ui_update: { row_color: "#6c757d", badge_text: "⏸ PAUSA", panel_status: "NO_BET" } } };
      }
      if (r.desfecho == null && r.resultado === "RED") {
        return {
          ...s, auditResult: "RED", auditNumero: r.n1, auditTimestamp: s.timestamp,
          desfechoSequencia: "n/a", galeNumero: r.n2 ?? null, gale1Usado: false, gale1Resultado: "n/a",
          auditMessage: "Primeiro giro perdido · aguardando GALE 1.",
        };
      }
      if (!r.desfecho || !["GREEN_DIRETO","GREEN_GALE1","FALHA_GIRO1","FALHA_GALE"].includes(r.desfecho)) return s;
      const final = r.desfecho === "GREEN_DIRETO" || r.desfecho === "GREEN_GALE1" ? "GREEN" as const : "RED" as const;
      return {
        ...s,
        auditResult: final,
        auditNumero: r.n1,
        auditTimestamp: s.timestamp,
        desfechoSequencia: r.desfecho === "FALHA_GALE" ? "FALHA_GALE1" : r.desfecho,
        galeNumero: r.n2 ?? null,
        gale1Usado: r.desfecho === "GREEN_GALE1" || r.desfecho === "FALHA_GALE",
        gale1Resultado: r.desfecho === "GREEN_GALE1" ? "GREEN" : r.desfecho === "FALHA_GALE" ? "RED" : "n/a",
        auditResultPayload: {
          ...s.auditResultPayload,
          current_number: r.n1,
          verdict: final,
          reason: "Resultado confirmado pelo resolver.",
          ui_update: { row_color: final === "GREEN" ? "#28a745" : "#dc3545", badge_text: final === "GREEN" ? "✅ GREEN" : "❌ RED", panel_status: final },
        },
      };
    });

    // Desfechos são derivados do catálogo em tempo de render; não usar ledger salvo como fonte da verdade.

    return { sinais, estatisticas: calcularEstatisticas(sinais), naoVistos: sinais.filter((s) => !estado.vistos.includes(s.id)), confirmados: estado.confirmados };
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
    const resolverV14Boot = autoTestResolverV14();
    const regimeBoot = autoTestRegimeV14();
    const padroesBoot = autoTestPadroes();
    const avaliadorBoot = rodarSelfTest();
    const combinedBoot = { ok: boot.ok && resolverV14Boot.ok && regimeBoot.ok && padroesBoot.ok && avaliadorBoot.ok, errors: [...boot.errors, ...resolverV14Boot.errors, ...regimeBoot.errors, ...padroesBoot.errors, ...avaliadorBoot.falhas.map((f) => `avaliador: ${JSON.stringify(f)}`)] };
    window.dispatchEvent(new CustomEvent("roleta:self-test", { detail: combinedBoot }));
    if (!combinedBoot.ok) window.dispatchEvent(new CustomEvent("roleta:resolver-failure", { detail: combinedBoot.errors }));


  }, []);

  return resultado;
}
