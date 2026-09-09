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
      { title: "Catalogação — Análise de Padrões de Roleta" },
      {
        name: "description",
        content:
          "Cadastre resultados de roleta, classifique automaticamente por terminal, cavalo, dúzia, coluna e seção, e detecte padrões de repetição, quebra e retorno.",
      },
      { property: "og:title", content: "Catalogação — Análise de Padrões de Roleta" },
      {
        property: "og:description",
        content: "Classificação automática e detecção de padrões em tempo real.",
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
  const popup = estado.config.alertasAtivos ? (naoVistos[naoVistos.length - 1] ?? null) : null;

  return (
    <AppShell>
      <h1 className="mb-3 text-lg font-black tracking-widest">CATALOGAÇÃO</h1>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
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
