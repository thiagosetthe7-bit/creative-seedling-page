import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/roleta/AppShell";
import { acoes } from "@/lib/roleta/store";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Catalogação" }] }),
  component: Configuracoes,
});

function Configuracoes() {
  return (
    <AppShell>
      <h1 className="mb-3 text-lg font-black tracking-widest">CONFIGURAÇÕES</h1>
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 text-xs font-black tracking-widest text-muted-foreground">HISTÓRICO DE GIROS</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          O módulo de estratégias e alertas antigos está desativado. Os giros existentes são preservados.
        </p>
        <button
          onClick={() => {
            if (confirm("Apagar todo o histórico de giros catalogados? Esta ação não pode ser desfeita.")) acoes.limpar();
          }}
          className="rounded border border-destructive px-3 py-1.5 text-sm font-bold text-destructive hover:bg-destructive/10"
        >
          LIMPAR HISTÓRICO
        </button>
      </section>
    </AppShell>
  );
}
