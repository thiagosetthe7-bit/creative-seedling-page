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
        <h1 className="text-lg font-black tracking-widest">ENGINE DE SINAIS ATIVA</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          VOLT Duplo, DELTA e BR Antecedente são recalculados a partir do histórico catalogado.
          Quando as regras forem atendidas, o alerta em tela cheia será exibido na página de catalogação.
          O motor identifica padrões configurados; não garante resultados futuros.
        </p>
        <Link to="/" className="mt-4 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-bold text-brand-foreground">
          ABRIR CATALOGAÇÃO
        </Link>
      </section>
    </AppShell>
  );
}
