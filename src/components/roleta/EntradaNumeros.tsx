import { useState } from "react";
import { corDoNumero } from "@/lib/roleta/classificacao";
import { acoes } from "@/lib/roleta/store";

const TOPO = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
const MEIO = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35];
const BAIXO = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];

function estiloCor(n: number) {
  const c = corDoNumero(n);
  if (c === "verde") return { backgroundColor: "#00C853", color: "#FFFFFF" };
  if (c === "vermelho") return { backgroundColor: "#D32F2F", color: "#FFFFFF" };
  return { backgroundColor: "#212121", color: "#FFFFFF" };
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

  const registrarNumero = (numero: number) => {
    acoes.adicionarNumero(numero);
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
          onClick={() => registrarNumero(0)}
          style={estiloCor(0)}
          className="zero-btn"
          aria-label="Zero"
        >
          0
        </button>

        <div className="number-grid" aria-label="Números da roleta">
          {[TOPO, MEIO, BAIXO].map((linha, linhaIndex) =>
            linha.map((numero) => (
              <button
                key={numero}
                onClick={() => registrarNumero(numero)}
                style={estiloCor(numero)}
                className="roulette-number-btn"
                data-row={linhaIndex}
                aria-label={"Número " + numero}
              >
                {numero}
              </button>
            )),
          )}
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
