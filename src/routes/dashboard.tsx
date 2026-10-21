import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/roleta/AppShell";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Módulo de sinais desativado — Roleta" }] }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <AppShell>
      <section className="rounded-lg border border-border bg-card p-4">
        <h1 className="text-lg font-black tracking-widest">MÓDULO DE SINAIS DESATIVADO</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          As estratégias, estatísticas de aposta e recomendações antigas foram desativadas para preparar a nova arquitetura.
          A catalogação e o histórico dos giros continuam disponíveis.
        </p>
      </section>
    </AppShell>
  );
}
