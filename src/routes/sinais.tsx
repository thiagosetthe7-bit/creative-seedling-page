import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/roleta/AppShell";
import { StatusTag } from "@/components/roleta/PainelSinais";
import { useSinais } from "@/lib/roleta/useSinais";
import { useEstado, acoes } from "@/lib/roleta/store";
import type { Sinal } from "@/lib/roleta/engine";

export const Route = createFileRoute("/sinais")({
  head: () => ({
    meta: [
      { title: "Histórico de Sinais — Roleta" },
      {
        name: "description",
        content: "Registro completo dos sinais detectados e seu contexto operacional.",
      },
      { property: "og:title", content: "Histórico de Sinais — Roleta" },
      {
        property: "og:description",
        content: "Todos os sinais detectados com contexto de sequência, quebra e retorno.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoricoSinais,
});

function HistoricoSinais() {
  const { sinais } = useSinais();
  const estado = useEstado();
  const [aberto, setAberto] = useState<Sinal | null>(null);
  const lista = [...sinais].reverse();

  return (
    <AppShell>
      <h1 className="mb-3 text-lg font-black tracking-widest">HISTÓRICO DE SINAIS</h1>

      <div className="mb-4 rounded-lg border border-border bg-card">
        <div className="border-b border-border px-3 py-2 text-xs font-black tracking-widest text-muted-foreground">
          TIMELINE
        </div>
        <ul className="max-h-56 divide-y divide-border overflow-auto text-xs">
          {lista.slice(0, 30).map((s) => (
            <li key={s.id}>
              <button
                onClick={() => setAberto(s)}
                className="flex w-full items-center gap-3 px-3 py-1.5 text-left hover:bg-accent"
              >
                <span className="text-muted-foreground">
                  {new Date(s.timestamp).toLocaleTimeString("pt-BR")}
                </span>
                <span className="font-bold">
                  {s.categoriaLabel} {s.alvo}
                </span>
                <span className="ml-auto">
                  <StatusTag status={s.status} />
                </span>
              </button>
            </li>
          ))}
          {lista.length === 0 && (
            <li className="px-3 py-6 text-center text-muted-foreground">Sem sinais ainda.</li>
          )}
        </ul>
      </div>

      <div className="overflow-auto rounded-lg border border-border bg-card">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-brand text-brand-foreground">
              {[
                "ID",
                "DATA",
                "HORA",
                "RODADA",
                "CATEGORIA",
                "ENTRADA",
                "SEQ.",
                "QUEBRA",
                "RETORNO",
                "RESULTADO",
                "STATUS",
                "",
              ].map((h) => (
                <th key={h} className="whitespace-nowrap px-2 py-2 text-left font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map((s) => (
              <tr key={s.id} className="border-b border-border/60 odd:bg-surface">
                <td className="px-2 py-1 text-muted-foreground">{s.id}</td>
                <td className="px-2 py-1">{new Date(s.timestamp).toLocaleDateString("pt-BR")}</td>
                <td className="px-2 py-1">{new Date(s.timestamp).toLocaleTimeString("pt-BR")}</td>
                <td className="px-2 py-1">{s.rodada}</td>
                <td className="px-2 py-1 font-semibold">{s.categoriaLabel}</td>
                <td className="px-2 py-1 font-black">{s.alvo}</td>
                <td className="px-2 py-1">{s.sequenciaInicial}x</td>
                <td className="px-2 py-1">{s.quebra}</td>
                <td className="px-2 py-1">{s.retorno}</td>
                <td className="px-2 py-1">
                  {s.numeroSeguinte !== null ? s.numeroSeguinte : "—"}
                </td>
                <td className="px-2 py-1">
                  <StatusTag status={s.status} />
                  {estado.confirmados.includes(s.id) && (
                    <span className="ml-1 text-[10px] text-muted-foreground">confirmado</span>
                  )}
                </td>
                <td className="px-2 py-1">
                  {s.status !== "CANCELADO" && (
                    <button
                      onClick={() => acoes.cancelar(s.id)}
                      className="rounded border border-border px-2 py-0.5 text-[11px] hover:bg-accent"
                    >
                      cancelar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhum sinal registrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setAberto(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-sm font-black tracking-widest">CONTEXTO DO SINAL</h2>
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Categoria</dt>
              <dd className="text-right font-bold">{aberto.categoriaLabel}</dd>
              <dt className="text-muted-foreground">Sequência</dt>
              <dd className="text-right font-bold">
                {aberto.sequenciaInicial}x {aberto.alvo}
              </dd>
              <dt className="text-muted-foreground">Quebra</dt>
              <dd className="text-right font-bold">
                {aberto.quebra} ({aberto.quebraRodadas}x)
              </dd>
              <dt className="text-muted-foreground">Retorno</dt>
              <dd className="text-right font-bold">{aberto.retorno}</dd>
              <dt className="text-muted-foreground">Número confirmador</dt>
              <dd className="text-right font-bold">{aberto.numero}</dd>
              <dt className="text-muted-foreground">Número posterior</dt>
              <dd className="text-right font-bold">{aberto.numeroSeguinte ?? "pendente"}</dd>
            </dl>
            <button
              onClick={() => setAberto(null)}
              className="mt-3 w-full rounded border border-border py-2 text-sm font-bold hover:bg-accent"
            >
              FECHAR
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
