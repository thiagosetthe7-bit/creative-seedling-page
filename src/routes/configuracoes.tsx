import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/roleta/AppShell";
import { CATEGORIAS } from "@/lib/roleta/classificacao";
import { useEstado, acoes } from "@/lib/roleta/store";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Análise de Padrões de Roleta" },
      {
        name: "description",
        content:
          "Ajuste o mínimo de repetições, escolha as categorias monitoradas, ative alertas e defina banca e unidade.",
      },
      { property: "og:title", content: "Configurações — Análise de Padrões de Roleta" },
      { property: "og:description", content: "Parâmetros da estratégia e da banca." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Configuracoes,
});

function Configuracoes() {
  const { config, banca } = useEstado();

  return (
    <AppShell>
      <h1 className="mb-3 text-lg font-black tracking-widest">CONFIGURAÇÕES</h1>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-xs font-black tracking-widest text-muted-foreground">
            ESTRATÉGIA
          </h2>

          <label className="block text-sm font-semibold">
            Mínimo de repetições para armar o padrão
            <input
              type="number"
              min={2}
              max={10}
              value={config.minimo}
              onChange={(e) =>
                acoes.atualizarConfig({ minimo: Math.max(2, Number(e.target.value) || 4) })
              }
              className="mt-1 w-24 rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Padrão 4. O sinal só é gerado após a sequência, a quebra (uma ou mais rodadas) e o
            retorno ao valor repetido.
          </p>

          <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={config.alertasAtivos}
              onChange={(e) => acoes.atualizarConfig({ alertasAtivos: e.target.checked })}
            />
            Alertas em pop-up ativados
          </label>
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-xs font-black tracking-widest text-muted-foreground">BANCA</h2>
          <div className="flex gap-4">
            <label className="text-sm font-semibold">
              Banca inicial
              <input
                type="number"
                min={0}
                value={banca.inicial}
                onChange={(e) => acoes.atualizarBanca({ inicial: Number(e.target.value) || 0 })}
                className="mt-1 block w-32 rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="text-sm font-semibold">
              Unidade por entrada
              <input
                type="number"
                min={1}
                value={banca.unidade}
                onChange={(e) => acoes.atualizarBanca({ unidade: Number(e.target.value) || 1 })}
                className="mt-1 block w-32 rounded border border-border bg-background px-2 py-1"
              />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <h2 className="mb-3 text-xs font-black tracking-widest text-muted-foreground">
            CATEGORIAS MONITORADAS
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {CATEGORIAS.map((c) => {
              const ativa = config.categoriasAtivas.includes(c.id);
              return (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ativa}
                    onChange={() =>
                      acoes.atualizarConfig({
                        categoriasAtivas: ativa
                          ? config.categoriasAtivas.filter((id) => id !== c.id)
                          : [...config.categoriasAtivas, c.id],
                      })
                    }
                  />
                  {c.label}
                </label>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <h2 className="mb-2 text-xs font-black tracking-widest text-muted-foreground">DADOS</h2>
          <button
            onClick={() => {
              if (confirm("Apagar todo o histórico de números e sinais?")) acoes.limpar();
            }}
            className="rounded border border-destructive px-3 py-1.5 text-sm font-bold text-destructive hover:bg-destructive/10"
          >
            LIMPAR HISTÓRICO
          </button>
        </section>
      </div>
    </AppShell>
  );
}
