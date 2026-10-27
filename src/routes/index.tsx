import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/roleta/AppShell";
import { EntradaNumeros } from "@/components/roleta/EntradaNumeros";
import { SignalPopup } from "@/components/roleta/SignalPopup";
import { SignalTrackingPanel } from "@/components/roleta/SignalTrackingPanel";
import { TabelaCatalogacao } from "@/components/roleta/TabelaCatalogacao";
import { useSinais } from "@/lib/roleta/useSinais";
import { acoes, useEstado } from "@/lib/roleta/store";
import { baixarCSVCatalogacao } from "@/lib/exportCatalogacao";
import { calcularBanca, carregarConfigBanca } from "@/lib/roleta/bankroll";
import { effectiveSignalResult, impactoFinanceiro, loadSessionFinance, SESSION_FINANCE_EVENT } from "@/lib/roleta/sessionFinance";

const dataLocalISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Catalogação — Roleta" },
      { name: "description", content: "Registro e classificação dos giros da roleta." },
      { property: "og:title", content: "Catalogação — Roleta" },
      { property: "og:description", content: "Registro manual de giros, análise de sinais e importação de histórico." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Catalogacao,
});

function Catalogacao() {
  const [financeRevision, setFinanceRevision] = useState(0);
  useEffect(() => { const sync = () => setFinanceRevision((n) => n + 1); window.addEventListener(SESSION_FINANCE_EVENT, sync); window.addEventListener("storage", sync); return () => { window.removeEventListener(SESSION_FINANCE_EVENT, sync); window.removeEventListener("storage", sync); }; }, []);
  void financeRevision;
  const estado = useEstado();
  const { sinais, smartGale, tracking } = useSinais();
  const configBanca = carregarConfigBanca();
  const financeLedger = loadSessionFinance();
  const sinaisFinanceiros = tracking.signals.filter((signal) => !financeLedger.removedSignalIds.includes(signal.id)).map((signal) => { const result = effectiveSignalResult(signal, financeLedger); return { ...signal, status: result === "PENDING" ? signal.status : "CONCLUÍDO" as const, result: result === "PENDING" ? "NO_SIGNAL" as const : result as typeof signal.result }; });
  const bancaDiaAtivo = configBanca.bancaInicial;
  const stopLossAtivo = bancaDiaAtivo * (configBanca.stopLossPercentual ?? 20) / 100;
  const resumoFinanceiro = calcularBanca(sinaisFinanceiros, configBanca);
  const resumoBanca = { ...resumoFinanceiro, stopLossCritico: resumoFinanceiro.reds > 0 && resumoFinanceiro.lucroLiquido <= -stopLossAtivo };
  const stakeR1Popup = configBanca.stakeR1PorArea * 2;
  const stakeR2Popup = stakeR1Popup * 2;
  const resultadoAutomaticoDia = tracking.signals.reduce((sum, signal) => { if (!signal.resultSpinId || financeLedger.removedSignalIds.includes(signal.id)) return sum; const spin = estado.spins.find((item) => item.id === signal.resultSpinId) ?? estado.spins.find((item) => item.id === signal.sourceSpinId); if (!spin) return sum; const d = new Date(spin.timestamp); const data = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; if (data !== dataLocalISO()) return sum; const result = effectiveSignalResult(signal, financeLedger); if (result === "PENDING" || result === "NO_SIGNAL" || result === "NOT_PICKED") return sum; return sum + (impactoFinanceiro(signal, configBanca, financeLedger) ?? 0); }, 0);
  const resultadoAtualDia = resultadoAutomaticoDia;
  const metaDiariaAtingida = Boolean(configBanca.bloquearSinaisMetaDiaria && linhaDia && resultadoAtualDia >= linhaDia.metaDia);
  const bloqueioFinanceiro = resumoBanca.metaBatida || metaDiariaAtingida;

  return (
    <AppShell>
      {bloqueioFinanceiro ? (
        <div role="alert" className="mb-4 rounded-lg border-2 border-rose-500 bg-rose-500/10 p-3 text-sm font-black text-rose-500">
          SINAIS BLOQUEADOS: {metaDiariaAtingida ? "META DIÁRIA ATINGIDA" : "META DA SESSÃO ATINGIDA"}. Encerre a sessão antes de considerar novas entradas.
        </div>
      ) : resumoBanca.stopLossCritico ? (
        <>
          <div role="alert" className="mb-4 rounded-lg border-2 border-rose-500 bg-rose-500/10 p-3 text-sm font-black text-rose-500">
            🔴 STOP LOSS ATINGIDO APÓS RED CONFIRMADO NO R2. Novas entradas R1 ficam suspensas; a recomendação Smart Gale 1 continua sendo exibida para não ocultar um R2 em andamento.
          </div>
          <SignalPopup signals={[]} smartGale={smartGale} stakeR1Total={stakeR1Popup} stakeR2Total={stakeR2Popup} />
        </>
      ) : <SignalPopup signals={sinais} smartGale={smartGale} stakeR1Total={stakeR1Popup} stakeR2Total={stakeR2Popup} />}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-black tracking-widest">CATALOGAÇÃO</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Registro manual ativo · engine VOLT Duplo e DELTA.
          </p>
        </div>
        <button
          type="button"
          onClick={() => baixarCSVCatalogacao(estado.spins, estado.bips, tracking.signals)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-black tracking-widest hover:bg-accent"
        >
          EXPORTAR CSV
        </button>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
        <div>
          <p className="text-sm font-bold">Tratamento do ZERO (0)</p>
          <p className="text-xs text-muted-foreground">Permite considerar o zero como proteção e avaliar reentrada VOLT/DELTA.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-black">
          <input
            type="checkbox"
            checked={estado.config.zeroComoProtecao}
            onChange={(event) => acoes.atualizarConfig({ zeroComoProtecao: event.target.checked })}
          />
          ZERO = PROTEÇÃO
        </label>
      </div>
      <div className="space-y-4">
        <SignalTrackingPanel signals={tracking.signals} />
        <EntradaNumeros total={estado.spins.length} />
        <TabelaCatalogacao spins={estado.spins} />
      </div>
    </AppShell>
  );
}
