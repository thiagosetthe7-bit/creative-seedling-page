import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/roleta/AppShell";
import { EntradaNumeros } from "@/components/roleta/EntradaNumeros";
import { TabelaCatalogacao } from "@/components/roleta/TabelaCatalogacao";
import { acoes, useEstado } from "@/lib/roleta/store";
import { baixarCSVCatalogacao, montarCSVCatalogacao, salvarArquivoSessaoForense } from "@/lib/exportCatalogacao";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Catalogação — Roleta" },
    { name: "description", content: "Registro e classificação manual dos giros da roleta." },
    { property: "og:title", content: "Catalogação — Roleta" },
    { property: "og:description", content: "Registro manual de giros e consulta das categorias catalogadas." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Catalogacao,
});

function Catalogacao() {
  const estado = useEstado();
  const exportar = () => baixarCSVCatalogacao(estado.spins, estado.bips);
  const novaSessao = () => {
    if (!window.confirm("Iniciar uma nova sessão? Os giros atuais serão exportados e depois removidos. As configurações de banca e as demais preferências serão preservadas.")) return;
    if (estado.spins.length) {
      const csv = montarCSVCatalogacao(estado.spins, estado.bips);
      salvarArquivoSessaoForense(csv);
      baixarCSVCatalogacao(estado.spins, estado.bips);
    }
    acoes.limpar();
  };
  return <AppShell>
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-lg font-black tracking-widest">CATALOGAÇÃO</h1><p className="mt-1 text-xs text-muted-foreground">Registro de giros e classificação automática das categorias da roleta.</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={exportar} className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-black tracking-widest hover:bg-accent">EXPORTAR CSV</button>
        <button type="button" onClick={novaSessao} className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-xs font-black tracking-widest text-emerald-500 hover:bg-emerald-500/20">+ NOVA SESSÃO</button>
      </div>
    </div>
    <div className="space-y-4"><EntradaNumeros total={estado.spins.length}/><TabelaCatalogacao spins={estado.spins}/></div>
  </AppShell>;
}
