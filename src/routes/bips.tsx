import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/roleta/AppShell";
import { corDoNumero } from "@/lib/roleta/classificacao";
import { acoes, useEstado } from "@/lib/roleta/store";

const NUMEROS = Array.from({ length: 37 }, (_, i) => i);

const ESTILO_BIP = {
  timer: { backgroundColor: "#FFD966", color: "#000000" },
  rolando: { backgroundColor: "#2196F3", color: "#FFFFFF" },
} as const;

function estiloNumero(n: number, marcado: "timer" | "rolando" | undefined) {
  if (marcado) return ESTILO_BIP[marcado];
  const c = corDoNumero(n);
  if (c === "verde") return { backgroundColor: "#0E8A45", color: "#FFFFFF" };
  if (c === "vermelho") return { backgroundColor: "#E03131", color: "#FFFFFF" };
  return { backgroundColor: "#111111", color: "#FFFFFF" };
}

export const Route = createFileRoute("/bips")({
  head: () => ({
    meta: [
      { title: "Bips — Análise de Padrões de Roleta" },
      {
        name: "description",
        content:
          "Marque qualquer número da roleta como BIP NO TIMER ou BIP ROLANDO para acompanhamento manual.",
      },
      { property: "og:title", content: "Bips — Análise de Padrões de Roleta" },
      { property: "og:description", content: "Marcação manual de números com bip no timer ou rolando." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Bips,
});

function Bips() {
  const { bips } = useEstado();

  const ciclar = (n: number) => {
    const atual = bips[n];
    const proximo = atual === undefined ? "timer" : atual === "timer" ? "rolando" : null;
    acoes.marcarBip(n, proximo);
  };

  return (
    <AppShell>
      <h1 className="mb-3 text-lg font-black tracking-widest">BIPS</h1>
      <section className="rounded-lg border border-border bg-card p-3">
        <p className="mb-3 text-xs text-muted-foreground">
          Clique em um número para alternar: <strong style={{ color: "#C9A227" }}>BIP NO TIMER</strong>{" "}
          → <strong style={{ color: "#2196F3" }}>BIP ROLANDO</strong> → sem marcação.
        </p>

        <div className="mb-3 flex flex-wrap gap-2 text-[11px] font-bold">
          <button
            onClick={() => acoes.limparBips()}
            className="rounded border border-border px-3 py-1.5 font-semibold text-roleta-vermelho hover:bg-accent"
          >
            LIMPAR MARCAÇÕES
          </button>
          <span
            className="rounded-sm px-2 py-1"
            style={{ backgroundColor: "#FFD966", color: "#000" }}
          >
            BIP NO TIMER
          </span>
          <span
            className="rounded-sm px-2 py-1"
            style={{ backgroundColor: "#2196F3", color: "#fff" }}
          >
            BIP ROLANDO
          </span>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1">
          {NUMEROS.map((n) => {
            const marcado = bips[n];
            return (
              <button
                key={n}
                onClick={() => ciclar(n)}
                style={estiloNumero(n, marcado)}
                className="flex h-14 flex-col items-center justify-center rounded-sm border border-[#3f3f3f] font-bold transition-transform hover:scale-105 active:scale-95"
              >
                <span className="text-base">{n}</span>
                <span className="text-[8px] font-black tracking-wider">
                  {marcado === "timer" ? "BIP TIMER" : marcado === "rolando" ? "BIP ROLANDO" : "—"}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
