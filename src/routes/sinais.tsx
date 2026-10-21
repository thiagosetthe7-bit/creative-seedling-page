import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/roleta/AppShell";

export const Route = createFileRoute("/sinais")({
  head: () => ({ meta: [{ title: "Módulo de sinais desativado — Roleta" }] }),
  component: HistoricoSinais,
});

function HistoricoSinais() {
  return (
    <AppShell>
      <section className="rounded-lg border border-border bg-card p-4">
        <h1 className="text-lg font-black tracking-widest">SINAIS DESATIVADOS</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O histórico de recomendações e os gatilhos antigos não são mais executados nem exibidos.
          Nenhum giro da catalogação foi apagado. Esta área será reutilizada pela nova arquitetura.
        </p>
      </section>
    </AppShell>
  );
}
