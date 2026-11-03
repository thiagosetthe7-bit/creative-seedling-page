import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/roleta/AppShell";
import { EntradaNumeros } from "@/components/roleta/EntradaNumeros";
import { TabelaCatalogacao } from "@/components/roleta/TabelaCatalogacao";
import { SignalPopup } from "@/components/roleta/SignalPopup";
import { SignalTrackingPanel } from "@/components/roleta/SignalTrackingPanel";
import { acoes, useEstado } from "@/lib/roleta/store";
import { useSinais } from "@/lib/roleta/useSinais";
import { baixarCSVCatalogacao } from "@/lib/exportCatalogacao";
import { assessSessionTrend } from "@/lib/roleta/sessionThermometer";

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
  const { sinais, tracking } = useSinais();
  const thermometer = assessSessionTrend(estado.spins, tracking.signals);
  return (
    <AppShell>
      <SignalPopup signals={sinais} autoCloseSeconds={15} />
      {thermometer.status !== "CALIBRATING" && <div role="status" aria-live="polite" className={`mb-4 rounded-xl border p-4 ${thermometer.status === "POSITIVE" ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200" : "border-rose-400/50 bg-rose-500/10 text-rose-200"}`}>
        <p className="text-sm font-black tracking-wide">{thermometer.status === "POSITIVE" ? "🟢 SESSÃO POSITIVA" : "🔴 SESSÃO NEGATIVA"} <span className="font-semibold">{thermometer.status === "POSITIVE" ? "(Estabilidade estrutural detectada)" : "(Alto ruído / Zigue-zague)"}</span></p>
        <p className="mt-1 text-[11px] opacity-80">Termômetro atualizado no checkpoint de {thermometer.checkpoint} giros • estabilidade estrutural {(thermometer.structuralScore * 100).toFixed(0)}%{thermometer.hitRate !== null ? ` • acerto recente ${(thermometer.hitRate * 100).toFixed(1)}% em ${thermometer.resolvedSignals} sinais resolvidos` : " • aguardando amostra de sinais resolvidos"}</p>
        {thermometer.changedToNegative && <p className="mt-2 rounded-lg border border-amber-300/40 bg-amber-400/15 px-3 py-2 text-xs font-black text-amber-100">⚠️ ATENÇÃO: A tendência da sessão mudou! O termômetro agora indica SESSÃO NEGATIVA.</p>}
      </div>}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-black tracking-widest">CATALOGAÇÃO</h1>
          <p className="mt-1 text-xs text-muted-foreground">Motores VOLT A/B e DELTA A/B • Zero neutro • janela de 30 giros</p>
        </div>
        <button type="button" onClick={() => baixarCSVCatalogacao(estado.spins, estado.bips, tracking.signals)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-black tracking-widest hover:bg-accent">
          EXPORTAR CSV
        </button>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
        <div>
          <p className="text-sm font-bold">Regra global do Zero</p>
          <p className="text-xs text-muted-foreground">Os 20 primeiros giros são pré-catalogação (não entram no Win Rate real). O zero é neutro: fica no histórico, não quebra a sequência e não conta para acumulação.</p>
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
