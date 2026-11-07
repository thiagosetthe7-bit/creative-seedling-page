import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/roleta/AppShell";
import { EntradaNumeros } from "@/components/roleta/EntradaNumeros";
import { TabelaCatalogacao } from "@/components/roleta/TabelaCatalogacao";
import { SignalPopup } from "@/components/roleta/SignalPopup";
import { SignalTrackingPanel } from "@/components/roleta/SignalTrackingPanel";
import { acoes, useEstado } from "@/lib/roleta/store";
import { useSinais } from "@/lib/roleta/useSinais";
import { baixarCSVCatalogacao, montarCSVCatalogacao, salvarArquivoSessaoForense } from "@/lib/exportCatalogacao";
import { carregarConfigBanca, diaAtivo } from "@/lib/roleta/bankroll";
import { effectiveSignalResult, impactoFinanceiro, loadSessionFinance, saveSessionFinance } from "@/lib/roleta/sessionFinance";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Catalogação — Roleta" },
      { name: "description", content: "Catalogação de giros com motores de análise VOLT A/B e DELTA A/B." },
      { property: "og:title", content: "Catalogação — Roleta" },
      { property: "og:description", content: "Registro manual de giros e análise de padrões configurados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Catalogacao,
});

function Catalogacao() {
  const estado = useEstado();
  const { sinais, tracking, macro } = useSinais();
  return (
    <AppShell>
      <SignalPopup signals={sinais} autoCloseSeconds={15} />
      <div role="status" aria-live="polite" className={`mb-4 rounded-xl border p-4 ${macro.status === "BLOCK" ? "border-rose-400/60 bg-rose-500/15 text-rose-200" : macro.status === "HIGH_SIGNAL" ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200" : macro.status === "ATLAS_TRIGGER" ? "border-amber-400/60 bg-amber-500/15 text-amber-100" : "border-sky-400/40 bg-sky-500/10 text-sky-100"}`}>
        <p className="text-sm font-black tracking-wide">{macro.status === "BLOCK" ? "🛑 BLOCK CAIXA" : macro.status === "HIGH_SIGNAL" ? "🟢 HIGH SIGNAL" : macro.status === "ATLAS_TRIGGER" ? "🟡 ATLAS TRIGGER" : "🔵 MONITORING"}</p>
        <p className="mt-1 text-xs opacity-90">{macro.message}</p>
        <p className="mt-2 text-[10px] opacity-70">Janela ativa: {macro.windowSize} giros • alternância crítica: {macro.altCount} setores • confluência: {macro.streakCount} setores</p>
      </div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-black tracking-widest">CATALOGAÇÃO</h1>
          <p className="mt-1 text-xs text-muted-foreground">MEMÓRIA MACRO • buffer deslizante de 30 giros • blindagem de caixa</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => baixarCSVCatalogacao(estado.spins, estado.bips, tracking.signals)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-black tracking-widest hover:bg-accent">
            EXPORTAR CSV
          </button>
          <button type="button" onClick={() => {
            if (!window.confirm("Iniciar uma nova sessão? Os giros e o catálogo atual serão limpos, mas a banca e os resultados financeiros do dia serão preservados.")) return;
            const forensicCsv = montarCSVCatalogacao(estado.spins, estado.bips, tracking.signals);
            salvarArquivoSessaoForense(forensicCsv);
            baixarCSVCatalogacao(estado.spins, estado.bips, tracking.signals);
            const config = carregarConfigBanca();
            const ledger = loadSessionFinance();
            const daily = { ...(ledger.archivedDailyResults ?? {}) };
            const spinById = new Map(estado.spins.map((spin) => [spin.id, spin] as const));
            for (const signal of tracking.signals) {
              if (ledger.removedSignalIds.includes(signal.id) || !signal.resultSpinId) continue;
              const impact = impactoFinanceiro(signal, config, ledger);
              if (impact === null) continue;
              const spin = spinById.get(signal.resultSpinId) ?? spinById.get(signal.sourceSpinId);
              if (!spin) continue;
              const date = new Date(spin.timestamp);
              const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
              const day = diaAtivo(config, dateKey);
              if (day < 1) continue;
              const adjustedImpact = ledger.financialOverrides?.[signal.id] ?? impact;
              daily[day] = (daily[day] ?? 0) + adjustedImpact;
            }
            saveSessionFinance({ ...ledger, archivedDailyResults: daily, archivedSignals: [...(ledger.archivedSignals ?? []).filter((old) => !tracking.signals.some((current) => current.id === old.id)), ...tracking.signals] });
            acoes.limpar();
          }}
            className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-xs font-black tracking-widest text-emerald-500 hover:bg-emerald-500/20">
            + NOVA SESSÃO
          </button>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
        <div>
          <p className="text-sm font-bold">Regra global do Zero</p>
          <p className="text-xs text-muted-foreground">Os primeiros 15 giros ficam em MONITORING. A janela macro é limitada aos giros recentes da mesa ativa; o Zero encerra a sequência corrente.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-black">
          <input type="checkbox" checked={estado.config.zeroComoProtecao}
            onChange={(event) => acoes.atualizarConfig({ zeroComoProtecao: event.target.checked })} />
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
