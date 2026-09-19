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
        content: "Indicadores de sinais: WIN, RED, pendentes, taxa de acerto e maiores sequências.",
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
        <Card titulo="WIN" valor={String(estatisticas.win)} cor="text-emerald-600" />
        <Card titulo="RED" valor={String(estatisticas.red)} cor="text-red-600" />
        <Card titulo="PENDENTES" valor={String(estatisticas.pendentes)} cor="text-amber-600" />
        <Card titulo="TAXA DE WIN" valor={`${estatisticas.taxaWin.toFixed(1)}%`} />
        <Card titulo="MAIOR SEQ. WIN" valor={String(estatisticas.maiorSeqWin)} />
        <Card titulo="MAIOR SEQ. RED" valor={String(estatisticas.maiorSeqRed)} />
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
            WIN x RED
          </h2>
          <div className="flex h-6 overflow-hidden rounded">
            <div
              className="bg-emerald-500"
              style={{ width: `${estatisticas.taxaWin}%` }}
              title={`WIN ${estatisticas.win}`}
            />
            <div
              className="bg-red-500"
              style={{ width: `${estatisticas.taxaRed}%` }}
              title={`RED ${estatisticas.red}`}
            />
          </div>
          <h2 className="mb-2 mt-4 text-xs font-black tracking-widest text-muted-foreground">
            EVOLUÇÃO DOS RESULTADOS
          </h2>
          <Evolucao
            pontos={sinais
              .filter((s) => s.status === "WIN" || s.status === "RED")
              .reduce<number[]>((acc, s) => {
                const anterior = acc.length ? acc[acc.length - 1]! : 0;
                acc.push(anterior + (s.status === "WIN" ? 1 : -1));
                return acc;
              }, [])}
          />
        </section>
      </div>
    </AppShell>
  );
}

function Evolucao({ pontos }: { pontos: number[] }) {
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
