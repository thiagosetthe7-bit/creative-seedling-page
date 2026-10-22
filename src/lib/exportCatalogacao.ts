import type { Spin } from "./roleta/catalogo";
import type { TipoBip } from "./roleta/store";

const CABECALHO = "GIRO;NUMERO;BT;BR;TERMINAL;CAVALO;AB;DUZIA;COLUNA;PI;TIPO;SECAO;010;22_34;COR;TIMESTAMP";

function celulaCSV(valor: unknown): string {
  const texto = String(valor ?? "");
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function dataHoraLocal(data: Date): { data: string; hora: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    data: `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`,
    hora: `${pad(data.getHours())}-${pad(data.getMinutes())}`,
  };
}

/** Monta o CSV de catalogação na mesma ordem visual da tabela: mais recente primeiro. */
export function montarCSVCatalogacao(spins: Spin[], bips: Record<string, TipoBip>): string {
  const linhas = [CABECALHO];
  const recentesPrimeiro = [...spins].reverse();

  recentesPrimeiro.forEach((spin, index) => {
    const c = spin.classificacao;
    const bip = bips[spin.id];
    linhas.push([
      index + 1,
      spin.numero,
      bip === "timer" ? "1" : "",
      bip === "rolando" ? "1" : "",
      c.terminal,
      c.cavalo,
      c.ab,
      c.duzia,
      c.coluna,
      c.pi,
      c.tipo,
      c.secao.toLocaleUpperCase("pt-BR"),
      c.g010,
      c.g2234,
      c.cor,
      new Date(spin.timestamp).toISOString(),
    ].map(celulaCSV).join(";"));
  });

  return "\uFEFF" + linhas.join("\r\n");
}

/** Exporta todos os giros registrados, incluindo as marcações BT/BR individuais. */
export function baixarCSVCatalogacao(spins: Spin[], bips: Record<string, TipoBip>): void {
  if (spins.length === 0) {
    window.alert("Nenhum dado para exportar");
    return;
  }

  const csv = montarCSVCatalogacao(spins, bips);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const agora = new Date();
  const { data, hora } = dataHoraLocal(agora);

  link.href = url;
  link.download = `catalogacao_roleta_${data}_${hora}.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
