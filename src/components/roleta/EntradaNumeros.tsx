import { useState } from "react";
import { corDoNumero } from "@/lib/roleta/classificacao";
import { acoes } from "@/lib/roleta/store";

const NUMEROS = Array.from({ length: 37 }, (_, i) => i);

function classeCor(n: number) {
  const c = corDoNumero(n);
  if (c === "verde") return "bg-felt text-white";
  if (c === "vermelho") return "bg-roleta-vermelho text-white";
  return "bg-roleta-preto text-white";
}

export function EntradaNumeros({ total }: { total: number }) {
  const [texto, setTexto] = useState("");

  const enviarTexto = () => {
    const nums = texto
      .split(/[^0-9]+/)
      .filter(Boolean)
      .map(Number)
      .filter((n) => n >= 0 && n <= 36);
    if (nums.length) acoes.adicionarVarios(nums);
    setTexto("");
  };

  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-black tracking-widest text-muted-foreground">
          ENTRADA DE RESULTADOS
        </h2>
        <span className="text-xs text-muted-foreground">{total} rodadas</span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(42px,1fr))] gap-1">
        {NUMEROS.map((n) => (
          <button
            key={n}
            onClick={() => acoes.adicionarNumero(n)}
            className={`h-10 rounded text-sm font-bold transition-transform hover:scale-105 active:scale-95 ${classeCor(n)}`}
          >
            {n}
          </button>
        ))}
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
