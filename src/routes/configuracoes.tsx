import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/roleta/AppShell";
import { CATEGORIAS } from "@/lib/roleta/classificacao";
import { useEstado, acoes } from "@/lib/roleta/store";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — BIP ANALYZER" },
      {
        name: "description",
        content:
          "Configurações operacionais do BIP ANALYZER, incluindo alertas e parâmetros de banca.",
      },
      { property: "og:title", content: "Configurações — BIP ANALYZER" },
      { property: "og:description", content: "Parâmetros operacionais do BIP ANALYZER." },
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
            MOTOR BIP
          </h2>
          <div className="rounded border border-border bg-muted/30 p-3 text-xs leading-relaxed">
            <p className="font-bold">Ordem operacional:</p>
            <p>BLOQUEIO &gt; ALTURA + COLUNA/DÚZIA &gt; FILTRO DE SESSÃO</p>
            <p className="mt-2">Zero anterior e Double BT geram somente PAUSA OPERACIONAL.</p>
            <p>BR usa ALTURA + cobertura obrigatória de 2 COLUNAS + 2 DÚZIAS.</p>
            <p>Sessão anterior é excluída passivamente; nunca é usada como gatilho ou aposta.</p><p>É proibido gerar cobertura de 3 sessões ou "todas exceto a anterior".</p>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={config.alertasAtivos}
              onChange={(e) => acoes.atualizarConfig({ alertasAtivos: e.target.checked })}
            />
            Alertas em pop-up ativados
          </label>

          <p className="mt-3 text-xs text-muted-foreground">
            Os percentuais exibidos são confiança operacional do padrão, não probabilidade estatística.
          </p>
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
            CATEGORIAS LEGADAS
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
