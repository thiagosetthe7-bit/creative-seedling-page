import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/roleta/AppShell";
import { useSinais } from "@/lib/roleta/useSinais";
import { CATEGORIAS } from "@/lib/roleta/classificacao";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Análise de Padrões de Roleta" },
      {
        name: "description",
        content: "Indicadores operacionais e distribuição de sinais por categoria.",
      },
      { property: "og:title", content: "Dashboard — Análise de Padrões de Roleta" },
      { property: "og:description", content: "Indicadores e distribuição de sinais por categoria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Card({ titulo, valor, cor }: { titulo: string; valor: string; cor?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] font-bold tracking-widest text-muted-foreground">{titulo}</div>
      <div className={`text-2xl font-black ${cor ?? ""}`}>{valor}</div>
    </div>
  );
}

function Dashboard() {
  const { sinais, estatisticas } = useSinais();
  const hoje = new Date().toDateString();
  const sinaisHoje = sinais.filter((s) => new Date(s.timestamp).toDateString() === hoje).length;

  const porCategoria = CATEGORIAS.map((c) => ({
    label: c.label,
    total: sinais.filter((s) => s.categoria === c.id).length,
    win: sinais.filter((s) => s.categoria === c.id && s.status === "WIN").length,
  })).filter((c) => c.total > 0);
  const maxCat = Math.max(1, ...porCategoria.map((c) => c.total));

  return (
    <AppShell>
      <h1 className="mb-3 text-lg font-black tracking-widest">DASHBOARD</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <Card titulo="SINAIS HOJE" valor={String(sinaisHoje)} />
        <Card titulo="PENDENTES" valor={String(estatisticas.pendentes)} cor="text-amber-600" />
        <Card titulo="CANCELADOS" valor={String(estatisticas.cancelados)} />
        <Card titulo="TOTAL DE SINAIS" valor={String(estatisticas.total)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-3">
          <h2 className="mb-3 text-xs font-black tracking-widest text-muted-foreground">
            SINAIS POR CATEGORIA
          </h2>
          <ul className="space-y-2">
            {porCategoria.map((c) => (
              <li key={c.label} className="text-xs">
                <div className="flex justify-between">
                  <span className="font-semibold">{c.label}</span>
                  <span className="text-muted-foreground">
                    {c.total} sinais · {c.win} win
                  </span>
                </div>
                <div className="mt-1 h-2 rounded bg-muted">
                  <div
                    className="h-2 rounded bg-brand"
                    style={{ width: `${(c.total / maxCat) * 100}%` }}
                  />
                </div>
              </li>
            ))}
            {porCategoria.length === 0 && (
              <li className="py-6 text-center text-xs text-muted-foreground">Sem dados.</li>
            )}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-card p-3">
          <h2 className="mb-3 text-xs font-black tracking-widest text-muted-foreground">
            DISTRIBUIÇÃO POR CATEGORIA
          </h2>
          <p className="text-xs text-muted-foreground">
            Os resultados GREEN/RED são exibidos exclusivamente em SINAIS ATIVOS.
          </p>
        </section>
      </div>
    </AppShell>
  );
}

function __REMOVER_ESTA_FUNCAO__({ pontos }: { pontos: number[] }) {
  if (pontos.length < 2) {
    return <p className="py-6 text-center text-xs text-muted-foreground">Dados insuficientes.</p>;
  }
  const max = Math.max(...pontos, 1);
  const min = Math.min(...pontos, -1);
  const d = pontos
    .map((p, i) => {
      const x = (i / (pontos.length - 1)) * 100;
      const y = 100 - ((p - min) / (max - min || 1)) * 100;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-28 w-full">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand" />
    </svg>
  );
}
