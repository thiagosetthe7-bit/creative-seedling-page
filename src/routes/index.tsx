import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/roleta/AppShell";
import { EntradaNumeros } from "@/components/roleta/EntradaNumeros";
import { TabelaCatalogacao } from "@/components/roleta/TabelaCatalogacao";
import { PainelSinais } from "@/components/roleta/PainelSinais";
import { PopupSinal } from "@/components/roleta/PopupSinal";
import { useSinais } from "@/lib/roleta/useSinais";
import { useEstado } from "@/lib/roleta/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BIP ANALYZER — Gerador de Sinais Visuais" },
      {
        name: "description",
        content:
          "Motor BIP para leitura da rodada anterior, BIP atual e próximo giro, com popups operacionais e bloqueio prioritário.",
      },
      { property: "og:title", content: "BIP ANALYZER — Gerador de Sinais Visuais" },
      {
        property: "og:description",
        content: "Bloqueio > Altura > Sessão > Coluna/Dúzia > Validação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Catalogacao,
});

function Catalogacao() {
  const estado = useEstado();
  const { sinais, naoVistos } = useSinais();

  const popup = estado.config.alertasAtivos
    ? [...naoVistos].sort((a, b) => {
        const peso = (p: string) => p === "CRITICAL" ? 0 : p === "HIGH" ? 1 : p === "MEDIUM" ? 2 : 3;
        return peso(a.priority) - peso(b.priority) || b.rodada - a.rodada;
      })[0] ?? null
    : null;

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-black tracking-widest">BIP ANALYZER</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Rodada anterior → BIP atual → próximo giro. Bloqueios têm prioridade absoluta.
          </p>
        </div>
        <div className="rounded border border-border bg-muted/40 px-3 py-1.5 text-[10px] font-black tracking-wide">
          BLOQUEIO &gt; ALTURA &gt; SESSÃO &gt; COLUNA/DÚZIA &gt; VALIDAÇÃO
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <EntradaNumeros total={estado.spins.length} />
          <TabelaCatalogacao spins={estado.spins} sinais={sinais} />
        </div>
        <PainelSinais sinais={sinais} />
      </div>

      {popup && <PopupSinal sinal={popup} />}
    </AppShell>
  );
}
