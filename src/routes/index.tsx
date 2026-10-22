import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/roleta/AppShell";
import { EntradaNumeros } from "@/components/roleta/EntradaNumeros";
import { SignalPopup } from "@/components/roleta/SignalPopup";
import { TabelaCatalogacao } from "@/components/roleta/TabelaCatalogacao";
import { useSinais } from "@/lib/roleta/useSinais";
import { useEstado } from "@/lib/roleta/store";
import { baixarCSVCatalogacao } from "@/lib/exportCatalogacao";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Catalogação — Roleta" },
      { name: "description", content: "Registro e classificação dos giros da roleta." },
      { property: "og:title", content: "Catalogação — Roleta" },
      { property: "og:description", content: "Registro manual de giros, classificações e marcações BT/BR." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Catalogacao,
});

function Catalogacao() {
  const estado = useEstado();
  const { sinais } = useSinais();

  return (
    <AppShell>
      <SignalPopup signals={sinais} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-black tracking-widest">CATALOGAÇÃO</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Registro manual ativo · engine VOLT Duplo, DELTA e BR Antecedente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => baixarCSVCatalogacao(estado.spins, estado.bips)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-black tracking-widest hover:bg-accent"
        >
          EXPORTAR CSV
        </button>
      </div>
      <div className="space-y-4">
        <EntradaNumeros total={estado.spins.length} />
        <TabelaCatalogacao spins={estado.spins} />
      </div>
    </AppShell>
  );
}
