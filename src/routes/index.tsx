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
  const [attentionMessage, setAttentionMessage] = useState("");
  const [dismissedAttention, setDismissedAttention] = useState("");

  useEffect(() => { const sync = () => setFinanceRevision((n) => n + 1); window.addEventListener(SESSION_FINANCE_EVENT, sync); window.addEventListener("storage", sync); return () => { window.removeEventListener(SESSION_FINANCE_EVENT, sync); window.removeEventListener("storage", sync); }; }, []);
  void financeRevision;
  const estado = useEstado();
  const { sinais, smartGale, tracking, blockedTargets, marketEntropy, zeroQuarantineActive } = useSinais();
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
  const metaDoDia = configBanca.metaModo === "valor" ? configBanca.metaValor : bancaDiaAtivo * configBanca.metaDiariaPercentual / 100;
  const metaDiariaAtingida = Boolean(configBanca.bloquearSinaisMetaDiaria && metaDoDia > 0 && resultadoAtualDia >= metaDoDia);
  const bloqueioFinanceiro = resumoBanca.metaBatida || metaDiariaAtingida;
  const attentionMessages = [
    ...(zeroQuarantineActive ? ["🛡️ QUARENTENA PÓS-ZERO: entradas suspensas até que a janela de segurança seja concluída."] : []),
    ...(!marketEntropy.isMarketSafe ? [`⚠️ DISPERSÃO DE RISCO: mesa de alta volatilidade/saturação em ${marketEntropy.dominantSector ?? "SETOR"}. Sinais VOLT/DELTA suspensos temporariamente.`] : []),
    ...blockedTargets.map(({ target, reason }) => reason === "WIN"
      ? `⚠️ ALERTA DE EXAUSTÃO: o alvo ${target} teve WIN recente sem reset de Zero. Entrada bloqueada.`
      : reason === "FAILED"
        ? `⚠️ ALERTA DE EXAUSTÃO: o alvo ${target} teve RED ou Gale bloqueado nesta sessão.`
        : `⚠️ ALERTA DE EXAUSTÃO: o alvo ${target} atingiu o limite de formações nesta sessão.`),
  ];
  const attentionKey = attentionMessages.join("\\n");
  useEffect(() => {
    if (!attentionKey) {
      setAttentionMessage("");
      setDismissedAttention("");
      return;
    }
    if (attentionKey !== dismissedAttention) setAttentionMessage(attentionKey);
  }, [attentionKey, dismissedAttention]);

  return (
    <AppShell>
      {attentionMessage && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" role="presentation">
          <section role="alertdialog" aria-modal="true" aria-labelledby="attention-modal-title" className="w-full max-w-2xl rounded-2xl border-4 border-amber-400 bg-slate-950 text-white shadow-[0_0_70px_rgba(251,146,60,0.35)]">
            <header className="border-b border-amber-400/40 bg-gradient-to-r from-amber-500/25 to-orange-500/10 p-5 sm:p-7">
              <h2 id="attention-modal-title" className="text-xl font-black text-amber-200 sm:text-3xl">⚠️ ALERTA DE ATENÇÃO DA MESA</h2>
              <p className="mt-2 text-sm text-amber-100">Leia os avisos antes de continuar.</p>
            </header>
            <div className="space-y-3 p-5 sm:p-7">
              {attentionMessage.split("\\n").filter(Boolean).map((message, index) => <p key={index} className="rounded-lg border border-amber-300/40 bg-amber-400/10 p-4 text-sm font-bold leading-relaxed text-amber-100">{message}</p>)}
              <button type="button" onClick={() => { setDismissedAttention(attentionKey); setAttentionMessage(""); }} className="w-full rounded-xl bg-amber-400 px-5 py-3 font-black text-slate-950 hover:bg-amber-300">Entendido / Ciente</button>
            </div>
          </section>
        </div>
      )}
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
      {zeroQuarantineActive && (
        <div role="alert" aria-live="assertive" className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/20 p-3 text-xs font-black text-amber-400">
          🛡️ QUARENTENA PÓS-ZERO: entradas suspensas. O motor só será reativado após quatro giros limpos e uma janela de padrão sem Zero.
        </div>
      )}
      <div role="status" aria-live="polite" className={`mb-3 flex items-center gap-2 rounded-lg border p-3 text-xs font-black ${marketEntropy.isMarketSafe ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-amber-500/30 bg-amber-500/20 text-amber-400"}`}>
        {marketEntropy.isMarketSafe
          ? "🟢 MERCADO ESTÁVEL — filtro de saturação liberado"
          : `🛡️ MESA DE ALTA VOLATILIDADE / SATURAÇÃO EM ${marketEntropy.dominantSector ?? "SETOR"}. SINAIS VOLT/DELTA SUSPENSOS TEMPORARIAMENTE.`}
      </div>
      {blockedTargets.map(({ target, reason }) => <div key={`${target}-${reason}`} role="alert" aria-live="assertive" className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/20 p-3 text-sm font-black text-amber-400">{reason === "WIN" ? `⚠️ ALERTA DE EXAUSTÃO: O alvo ${target} já teve um WIN recente nesta sessão sem reset de Zero. Entrada bloqueada para evitar repetição exausta.` : reason === "FAILED" ? `⚠️ ALERTA DE EXAUSTÃO: O alvo ${target} teve RED ou Gale Bloqueado nesta sessão. Nova formação bloqueada para evitar repetição negativa.` : `⚠️ LIMITE DE EXAUSTÃO: O alvo ${target} já atingiu duas formações nesta sessão. Nova entrada bloqueada.`}</div>)}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-black tracking-widest">CATALOGAÇÃO</h1>
        </div>
        <button
          type="button"
          onClick={() => baixarCSVCatalogacao(estado.spins, estado.bips, tracking.signals, financeLedger.corrections)}
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
