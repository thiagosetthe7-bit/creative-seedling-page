import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/roleta/AppShell";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Painel estatístico — Roleta" }] }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <AppShell>
      <section className="rounded-lg border border-border bg-card p-4">
        <h1 className="text-lg font-black tracking-widest">PAINEL ESTATÍSTICO EM REESTRUTURAÇÃO</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          O painel antigo de desempenho de apostas foi desativado. A nova engine de gatilhos está disponível
          na catalogação e detecta VOLT Duplo, DELTA e BR Antecedente com as regras configuradas.
        </p>
        <Link to="/" className="mt-4 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-bold text-brand-foreground">
          ABRIR CATALOGAÇÃO
        </Link>
      </section>
    </AppShell>
  );
}
