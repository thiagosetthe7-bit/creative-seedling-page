import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/roleta/AppShell";
import { EntradaNumeros } from "@/components/roleta/EntradaNumeros";
import { TabelaCatalogacao } from "@/components/roleta/TabelaCatalogacao";
import { acoes, useEstado } from "@/lib/roleta/store";
import { baixarCSVCatalogacao } from "@/lib/exportCatalogacao";
import { useSinais } from "@/lib/roleta/useSinais";
import { SignalTrackingPanel } from "@/components/roleta/SignalTrackingPanel";
import { SignalPopup } from "@/components/roleta/SignalPopup";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Catalogação — Roleta" },
      { name: "description", content: "Registro bruto dos giros da roleta." },
      { property: "og:title", content: "Catalogação — Roleta" },
      { property: "og:description", content: "Registro manual e importação de histórico de giros." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Catalogacao,
});

function Catalogacao() {
  const estado = useEstado();
  const { tracking, alertas } = useSinais();

  return (
    <AppShell>
      <SignalPopup signals={alertas} autoCloseSeconds={8} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-lg font-black tracking-widest">CATALOGAÇÃO</h1>
        <button
          type="button"
          onClick={() => baixarCSVCatalogacao(estado.spins, estado.bips)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-black tracking-widest hover:bg-accent"
        >
          EXPORTAR CSV
        </button>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
        <div>
          <p className="text-sm font-bold">Tratamento do ZERO (0)</p>
          <p className="text-xs text-muted-foreground">O zero permanece registrado e classificado como parte do histórico bruto.</p>
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
