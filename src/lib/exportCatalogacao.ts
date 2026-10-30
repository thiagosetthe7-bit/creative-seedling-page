import type { Spin } from "./roleta/catalogo";
import type { TipoBip } from "./roleta/store";

const CABECALHO = "Spin_Index;Number;Terminal;Cavalo;High_Low;Dozen;Column;Even_Odd;Type;Section;Axis_0_10;Axis_22_34;Color;BR_Flag;BT_Flag";

function celulaCSV(valor: unknown): string {
  const texto = String(valor ?? "");
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** Exporta somente os dados brutos catalogados, sem estratégias, sinais ou resultados calculados. */
export function montarCSVCatalogacao(
  spins: Spin[],
  bips: Record<string, TipoBip>,
): string {
  const linhas = [CABECALHO];
  spins.forEach((spin, index) => {
    const c = spin.classificacao;
    const bip = bips[spin.id];
    linhas.push([
      index + 1,
      spin.numero,
      c.terminal,
      c.cavalo,
      c.ab,
      c.duzia,
      c.coluna,
      c.pi,
      c.tipo,
      c.secao,
      c.g010,
      c.g2234,
      c.cor,
      bip === "rolando" ? "1" : "0",
      bip === "timer" ? "1" : "0",
    ].map(celulaCSV).join(";"));
  });
  return "\uFEFF" + linhas.join("\r\n");
}

export function baixarCSVCatalogacao(
  spins: Spin[],
  bips: Record<string, TipoBip>,
): void {
  if (spins.length === 0) {
    window.alert("Nenhum dado para exportar");
    return;
  }
  const csv = montarCSVCatalogacao(spins, bips);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const agora = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  link.href = url;
  link.download = `catalogacao_roleta_${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}_${pad(agora.getHours())}-${pad(agora.getMinutes())}.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
