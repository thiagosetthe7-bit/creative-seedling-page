import { CATEGORIAS, corDoNumero } from "@/lib/roleta/classificacao";
import { estiloCelula } from "@/lib/roleta/paleta";
import type { Sinal, Spin } from "@/lib/roleta/engine";
import { acoes, useEstado } from "@/lib/roleta/store";

function estiloNumero(n: number) {
  const c = corDoNumero(n);
  if (c === "verde") return { backgroundColor: "#0E8A45", color: "#FFFFFF" };
  if (c === "vermelho") return { backgroundColor: "#E03131", color: "#FFFFFF" };
  return { backgroundColor: "#111111", color: "#FFFFFF" };
}

function estiloBipCell(ativo: boolean, tipo: "timer" | "rolando") {
  if (ativo && tipo === "timer") return { backgroundColor: "#FFD966", color: "#111111" };
  if (ativo && tipo === "rolando") return { backgroundColor: "#2196F3", color: "#FFFFFF" };
  if (tipo === "timer") return { backgroundColor: "#FFF7DC", color: "#B29A45" };
  return { backgroundColor: "#E3F0FD", color: "#6FA8D6" };
}

export function TabelaCatalogacao({ spins, sinais }: { spins: Spin[]; sinais: Sinal[] }) {
  const { bips } = useEstado();
  const porRodada = new Map<number, Sinal[]>();
  for (const s of sinais) {
    porRodada.set(s.rodada, [...(porRodada.get(s.rodada) ?? []), s]);
  }
  const linhas = spins.map((spin, i) => ({ spin, rodada: i + 1 })).reverse();

  return (
    <section className="rounded-sm border border-[#3f3f3f] bg-white">
      <div className="flex items-center justify-between border-b border-[#3f3f3f] bg-[#111111] px-2 py-1">
        <h2 className="text-[11px] font-bold tracking-widest text-[#FFD966]">CATALOGAÇÃO</h2>
        <span className="text-[10px] text-white/60">mais recente no topo</span>
      </div>
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full border-collapse text-[11px] leading-none">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#111111] text-[#FFD966]">
              <th className="border border-[#3f3f3f] px-1 py-1.5 text-center font-bold">#</th>
              <th className="border border-[#3f3f3f] px-1 py-1.5 text-center font-bold">Nº</th>
              <th
                className="border border-[#3f3f3f] bg-[#5c4d10] px-1 py-1.5 text-center font-bold"
                title="BT - BIP NO TIMER"
              >
                BT
              </th>
              <th
                className="border border-[#3f3f3f] bg-[#0f4c81] px-1 py-1.5 text-center font-bold"
                title="BR - BIP ROLANDO"
              >
                BR
              </th>
              {CATEGORIAS.map((c) => (
                <th
                  key={c.id}
                  className="whitespace-nowrap border border-[#3f3f3f] px-2 py-1.5 text-center font-bold"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr>
                <td
                  colSpan={CATEGORIAS.length + 4}
                  className="border border-[#3f3f3f] px-3 py-8 text-center text-[#666]"
                >
                  Nenhum resultado cadastrado ainda.
                </td>
              </tr>
            )}
            {linhas.map(({ spin, rodada }) => {
              const sinaisLinha = porRodada.get(rodada) ?? [];
              const catsComSinal = new Set(sinaisLinha.map((s) => s.categoria));
              const auditoria = sinaisLinha.find((s) => s.auditResult !== "NEUTRAL");
              const rowColor = auditoria?.auditColor;
              const rowBadge = auditoria?.auditResult === "GREEN" ? "✓ GREEN" : auditoria?.auditResult === "RED" ? "✗ RED" : auditoria?.auditResult === "PARTIAL" ? "PARCIAL" : auditoria ? "NEUTRO" : "";
              return (
                <tr key={spin.id} style={rowColor ? { boxShadow: `inset 5px 0 0 ${rowColor}` } : undefined}>
                  <td className="border border-[#3f3f3f] bg-[#f2f2f2] px-1 py-[3px] text-center text-[10px] text-[#666]">
                    {rowBadge && <div className="font-black" style={{ color: rowColor }}>{rowBadge}</div>}
                    {rodada}
                  </td>
                  <td
                    className="border border-[#3f3f3f] px-1 py-[3px] text-center font-bold"
                    style={estiloNumero(spin.numero)}
                  >
                    {spin.numero}
                  </td>
                  {(["timer", "rolando"] as const).map((tipo) => {
                    const ativo = bips[spin.id] === tipo;
                    return (
                      <td
                        key={tipo}
                        className="border border-[#3f3f3f] p-0 text-center"
                        style={estiloBipCell(ativo, tipo)}
                      >
                        <button
                          onClick={() =>
                            acoes.marcarBip(spin.id, ativo ? null : tipo)
                          }
                          title={
                            tipo === "timer"
                              ? `BT - BIP NO TIMER (nº ${spin.numero})`
                              : `BR - BIP ROLANDO (nº ${spin.numero})`
                          }
                          className={`h-full w-full px-1 py-[3px] text-[9px] font-black tracking-wide transition-transform active:scale-95 ${
                            ativo ? "opacity-100" : "opacity-60 hover:opacity-100"
                          }`}
                        >
                          {ativo ? (tipo === "timer" ? "BT" : "BR") : "—"}
                        </button>
                      </td>
                    );
                  })}
                  {CATEGORIAS.map((c) => {
                    const valor = spin.classificacao[c.id];
                    const e = estiloCelula(c.id, valor);
                    const marcado = catsComSinal.has(c.id);
                    return (
                      <td
                        key={c.id}
                        className={`whitespace-nowrap border px-2 py-[3px] text-center font-bold ${
                          marcado ? "border-2 border-[#FF3B30]" : "border-[#3f3f3f]"
                        }`}
                        style={{ backgroundColor: e.bg, color: e.fg }}
                        title={marcado ? `Sinal detectado • ${auditoria?.auditMessage ?? "aguardando auditoria"}` : undefined}
                      >
                        {valor}
                        {marcado && auditoria && <span className="ml-1 text-[9px] font-black" style={{ color: auditoria.auditColor }}>
                          {auditoria.auditResult === "GREEN" ? "✓" : auditoria.auditResult === "RED" ? "✗" : auditoria.auditResult === "PARTIAL" ? "≈" : "•"}
                        </span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
