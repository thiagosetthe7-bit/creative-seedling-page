import { useState } from "react";
import { corDoNumero } from "@/lib/roleta/classificacao";
import { acoes, useEstado } from "@/lib/roleta/store";

const NUMEROS = Array.from({ length: 37 }, (_, i) => i);

function estiloCor(n: number) {
  const c = corDoNumero(n);
  if (c === "verde") return { backgroundColor: "#0E8A45", color: "#FFFFFF" };
  if (c === "vermelho") return { backgroundColor: "#E03131", color: "#FFFFFF" };
  return { backgroundColor: "#111111", color: "#FFFFFF" };
}

export function EntradaNumeros({ total }: { total: number }) {
  const [texto, setTexto] = useState("");
  const { pendentes } = useEstado();

  const enviarTexto = () => {
    const nums = texto
      .split(/[^0-9]+/)
      .filter(Boolean)
      .map(Number)
      .filter((n) => n >= 0 && n <= 36);
    if (nums.length) acoes.adicionarVarios(nums);
    setTexto("");
  };

  const colunas = [
    Array.from({ length: 12 }, (_, i) => 1 + i * 3),
    Array.from({ length: 12 }, (_, i) => 2 + i * 3),
    Array.from({ length: 12 }, (_, i) => 3 + i * 3),
  ];

  const renderNumero = (n: number) => {
    const marcado = pendentes[n];
    return (
      <div key={n} className="roulette-number-cell">
        <button
          onClick={() => acoes.adicionarNumero(n)}
          style={estiloCor(n)}
          className="roulette-number-btn"
        >
          {n}
        </button>
        <div className="roulette-toggle-row">
          <button
            onClick={() => acoes.marcarPendente(n, marcado === "timer" ? null : "timer")}
            title="BT - BIP NO TIMER (vale para a próxima catalogação deste número)"
            className={`roulette-toggle roulette-toggle-bt ${marcado === "timer" ? "is-active" : ""}`}
          >
            BT
          </button>
          <button
            onClick={() => acoes.marcarPendente(n, marcado === "rolando" ? null : "rolando")}
            title="BR - BIP ROLANDO (vale para a próxima catalogação deste número)"
            className={`roulette-toggle roulette-toggle-br ${marcado === "rolando" ? "is-active" : ""}`}
          >
            BR
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-black tracking-widest text-muted-foreground">
          ENTRADA DE RESULTADOS
        </h2>
        <span className="text-xs text-muted-foreground">{total} rodadas</span>
      </div>

      <div className="roulette-table-container" aria-label="Mesa de roleta">
        <button
          onClick={() => acoes.adicionarNumero(0)}
          style={estiloCor(0)}
          className="zero-btn"
          aria-label="Zero"
        >
          0
        </button>

        <div className="number-grid">
          {colunas.map((coluna) => coluna.map(renderNumero))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviarTexto()}
          placeholder="Digitar números (ex.: 17 32 23)"
          className="min-w-[200px] flex-1 rounded border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button
          onClick={enviarTexto}
          className="rounded bg-brand px-4 py-2 text-sm font-bold text-brand-foreground"
        >
          ADICIONAR
        </button>
        <button
          onClick={() => acoes.desfazer()}
          className="rounded border border-border px-3 py-2 text-sm font-semibold hover:bg-accent"
        >
          DESFAZER
        </button>
        <button
          onClick={() => {
            if (confirm("Limpar todo o histórico e sinais?")) acoes.limpar();
          }}
          className="rounded border border-border px-3 py-2 text-sm font-semibold text-roleta-vermelho hover:bg-accent"
        >
          LIMPAR
        </button>
      </div>
    </section>
  );
}
