import { CATEGORIAS, corDoNumero } from "@/lib/roleta/classificacao";
import type { Sinal, Spin } from "@/lib/roleta/engine";

function corNumero(n: number) {
  const c = corDoNumero(n);
  if (c === "verde") return "bg-felt text-white";
  if (c === "vermelho") return "bg-roleta-vermelho text-white";
  return "bg-roleta-preto text-white";
}

export function TabelaCatalogacao({ spins, sinais }: { spins: Spin[]; sinais: Sinal[] }) {
  const porRodada = new Map<number, Sinal[]>();
  for (const s of sinais) {
    porRodada.set(s.rodada, [...(porRodada.get(s.rodada) ?? []), s]);
  }
  const linhas = spins.map((spin, i) => ({ spin, rodada: i + 1 })).reverse();

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-xs font-black tracking-widest text-muted-foreground">CATALOGAÇÃO</h2>
        <span className="text-xs text-muted-foreground">mais recente no topo</span>
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-brand text-brand-foreground">
              <th className="px-2 py-2 text-left font-bold">#</th>
              <th className="px-2 py-2 text-left font-bold">NÚMERO</th>
              {CATEGORIAS.map((c) => (
                <th key={c.id} className="whitespace-nowrap px-2 py-2 text-left font-bold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr>
                <td
                  colSpan={CATEGORIAS.length + 2}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  Nenhum resultado cadastrado ainda.
                </td>
              </tr>
            )}
            {linhas.map(({ spin, rodada }) => {
              const sinaisLinha = porRodada.get(rodada) ?? [];
              const catsComSinal = new Set(sinaisLinha.map((s) => s.categoria));
              return (
                <tr
                  key={spin.id}
                  className={`border-b border-border/60 ${
                    sinaisLinha.length ? "bg-sinal/10" : "odd:bg-surface"
                  }`}
                >
                  <td className="px-2 py-1 text-muted-foreground">{rodada}</td>
                  <td className="px-2 py-1">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded font-bold ${corNumero(spin.numero)}`}
                    >
                      {spin.numero}
                    </span>
                  </td>
                  {CATEGORIAS.map((c) => (
                    <td
                      key={c.id}
                      className={`whitespace-nowrap px-2 py-1 font-medium ${
                        catsComSinal.has(c.id)
                          ? "bg-sinal font-bold text-sinal-foreground"
                          : ""
                      }`}
                    >
                      {spin.classificacao[c.id]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
