import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/roleta/AppShell";

export const Route = createFileRoute("/sinais")({
  head: () => ({ meta: [{ title: "Engine de sinais — Roleta" }] }),
  component: HistoricoSinais,
});

function HistoricoSinais() {
  return (
    <AppShell>
      <section className="rounded-lg border border-border bg-card p-4 sm:p-6">
        <h1 className="text-lg font-black tracking-widest">ANÁLISE VOLT</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          O módulo observa apenas padrões VOLT em dúzias e colunas, usando até 20 giros desde o zero mais recente. O histórico financeiro permite corrigir manualmente os resultados. Frequências passadas não garantem resultados futuros.
        </p>
        <Link to="/" className="mt-4 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-bold text-brand-foreground">
          ABRIR CATALOGAÇÃO
        </Link>
      </section>
    </AppShell>
  );
}
