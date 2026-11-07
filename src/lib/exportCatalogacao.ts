import type { Spin } from "./roleta/catalogo";
import type { TipoBip } from "./roleta/store";

const CABECALHO = "Spin_Index;Timestamp;Number;Terminal;Cavalo;High_Low;Dozen;Column;Even_Odd;Type;Section;Axis_0_10;Axis_22_34;Color;Bip";
function celulaCSV(valor: unknown): string {
  const texto = String(valor ?? "");
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}
export function montarCSVCatalogacao(spins: Spin[], bips: Record<string, TipoBip>): string {
  const linhas = [CABECALHO];
  spins.forEach((spin, index) => {
    const c = spin.classificacao;
    linhas.push([
      index + 1, new Date(spin.timestamp).toISOString(), spin.numero,
      c.terminal, c.cavalo, c.ab, c.duzia, c.coluna, c.pi, c.tipo,
      c.secao, c.g010, c.g2234, c.cor, bips[spin.id] ?? "",
    ].map(celulaCSV).join(";"));
  });
  return "\uFEFF" + linhas.join("\r\n");
}
export function baixarCSVCatalogacao(spins: Spin[], bips: Record<string, TipoBip>): void {
  if (!spins.length) { window.alert("Nenhum dado para exportar"); return; }
  const blob = new Blob([montarCSVCatalogacao(spins, bips)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const now = new Date(); const pad = (n: number) => String(n).padStart(2, "0");
  link.href = url;
  link.download = `catalogacao_sessao_${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.csv`;
  link.style.display = "none"; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const FORENSIC_ARCHIVE_KEY = "roleta-catalogacao-archive-v1";
interface CatalogArchive { id: string; closedAt: string; spinCount: number; csv: string; }
export function salvarArquivoSessaoForense(csv: string): void {
  if (typeof window === "undefined" || !csv) return;
  try {
    const stored = JSON.parse(window.localStorage.getItem(FORENSIC_ARCHIVE_KEY) || "[]");
    const archives: CatalogArchive[] = Array.isArray(stored) ? stored : [];
    const rows = csv.replace(/^\uFEFF/, "").split(/\r?\n/).slice(1).filter((line) => line.trim());
    archives.push({ id: `catalog-1794071694673`, closedAt: new Date().toISOString(), spinCount: rows.length, csv });
    window.localStorage.setItem(FORENSIC_ARCHIVE_KEY, JSON.stringify(archives.slice(-30)));
  } catch { window.alert("Não foi possível guardar o arquivo da catalogação no navegador."); }
}
