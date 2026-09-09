import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/roleta/AppShell";
import { StatusTag } from "@/components/roleta/PainelSinais";
import { criarSpin, detectarSinais, calcularEstatisticas } from "@/lib/roleta/engine";
import { useEstado } from "@/lib/roleta/store";

export const Route = createFileRoute("/simulador")({
  head: () => ({
    meta: [
      { title: "Simulador — Análise de Padrões de Roleta" },
      {
        name: "description",
        content:
          "Cole uma sequência histórica de números e veja quantos sinais a estratégia teria gerado, com WIN, RED e evolução da banca.",
      },
      { property: "og:title", content: "Simulador — Análise de Padrões de Roleta" },
      { property: "og:description", content: "Teste a estratégia sobre dados históricos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Simulador,
});

function Simulador() {
  const { config, banca } = useEstado();
  const [texto, setTexto] = useState("");
  const [sequencia, setSequencia] = useState<number[]>([]);

  const { sinais, estatisticas, saldoFinal } = useMemo(() => {
    const spins = sequencia.map((n) => criarSpin(n));
    const s = detectarSinais(spins, {
      minimo: config.minimo,
      categorias: config.categoriasAtivas,
    });
    const saldo = s.reduce(
      (acc, sinal) =>
        sinal.status === "WIN"
          ? acc + banca.unidade
          : sinal.status === "RED"
            ? acc - banca.unidade
            : acc,
      banca.inicial,
    );
    return { sinais: s, estatisticas: calcularEstatisticas(s), saldoFinal: saldo };
  }, [sequencia, config.minimo, config.categoriasAtivas, banca.inicial, banca.unidade]);

  function executar() {
    const numeros = texto
      .split(/[^0-9]+/)
      .filter(Boolean)
      .map(Number)
      .filter((n) => n >= 0 && n <= 36);
    setSequencia(numeros);
  }

  return (
    <AppShell>
      <h1 className="mb-3 text-lg font-black tracking-widest">SIMULADOR / TESTE</h1>

      <section className="rounded-lg border border-border bg-card p-4">
        <label className="text-xs font-black tracking-widest text-muted-foreground">
          SEQUÊNCIA HISTÓRICA (números de 0 a 36, separados por espaço, vírgula ou linha)
        </label>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          placeholder="17 32 5 5 5 5 12 5 ..."
          className="mt-2 w-full rounded border border-border bg-background p-2 font-mono text-sm"
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={executar}
            className="rounded bg-brand px-4 py-2 text-sm font-bold text-brand-foreground"
          >
            RODAR SIMULAÇÃO
          </button>
          <button
            onClick={() => {
              setTexto("");
              setSequencia([]);
            }}
            className="rounded border border-border px-4 py-2 text-sm font-bold hover:bg-accent"
          >
            LIMPAR
          </button>
        </div>
      </section>

      {sequencia.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
            <Card titulo="RODADAS" valor={String(sequencia.length)} />
            <Card titulo="SINAIS" valor={String(sinais.length)} />
            <Card titulo="WIN" valor={String(estatisticas.win)} />
            <Card titulo="RED" valor={String(estatisticas.red)} />
            <Card titulo="TAXA DE WIN" valor={`${estatisticas.taxaWin.toFixed(1)}%`} />
            <Card
              titulo="BANCA FINAL"
              valor={saldoFinal.toLocaleString("pt-BR")}
              cor={saldoFinal >= banca.inicial ? "text-emerald-600" : "text-red-600"}
            />
          </div>

          <div className="mt-4 overflow-auto rounded-lg border border-border bg-card">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-brand text-brand-foreground">
                  {["RODADA", "CATEGORIA", "ENTRADA", "SEQ.", "QUEBRA", "RETORNO", "STATUS"].map(
                    (h) => (
                      <th key={h} className="px-2 py-2 text-left font-bold">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {sinais.map((s) => (
                  <tr key={s.id} className="border-b border-border/60 odd:bg-surface">
                    <td className="px-2 py-1">{s.rodada}</td>
                    <td className="px-2 py-1 font-semibold">{s.categoriaLabel}</td>
                    <td className="px-2 py-1 font-black">{s.alvo}</td>
                    <td className="px-2 py-1">{s.sequenciaInicial}x</td>
                    <td className="px-2 py-1">{s.quebra}</td>
                    <td className="px-2 py-1">{s.retorno}</td>
                    <td className="px-2 py-1">
                      <StatusTag status={s.status} />
                    </td>
                  </tr>
                ))}
                {sinais.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      Nenhum sinal nesta sequência.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppShell>
  );
}

function Card({ titulo, valor, cor }: { titulo: string; valor: string; cor?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] font-bold tracking-widest text-muted-foreground">{titulo}</div>
      <div className={`text-2xl font-black ${cor ?? ""}`}>{valor}</div>
    </div>
  );
}
