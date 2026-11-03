import type { Spin } from "./roleta/catalogo";
import type { TipoBip } from "./roleta/store";
import type { TrackedSignal } from "./roleta/signalTracking";
import { carregarConfigBanca } from "./roleta/bankroll";
import { effectiveSignalResult, impactoFinanceiro, loadSessionFinance } from "./roleta/sessionFinance";

const CABECALHO = "Spin_Index;Number;Triggered_Strategy;Target_Bet;Signal_Status;Financial_Impact;Signal_Source_Spin_Index;Terminal;Cavalo;High_Low;Dozen;Column;Even_Odd;Type;Section;Axis_0_10;Axis_22_34;Color;BR_Flag;BT_Flag";

function celulaCSV(valor: unknown): string {
  const texto = String(valor ?? "");
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function statusCSV(signal: TrackedSignal): string {
  const ledger = loadSessionFinance();
  const result = effectiveSignalResult(signal, ledger);
  if (signal.preCatalog && result === "NOT_PICKED") return "Pré-Catalogação";
  const labels: Record<string, string> = {
    GREEN_R1: "Green R1",
    GREEN_GALE1: "Green Gale 1",
    RED: "Red",
    GALE_BLOCKED: "Gale Bloqueado",
    BLOCKED: "Gale Bloqueado",
    NOT_PICKED: "Não Peguei",
    PENDING: "Pendente",
    NO_SIGNAL: "NO_SIGNAL",
  };
  return labels[result] ?? "Pendente";
}

/**
 * Exporta a catalogação completa com o sinal associado ao giro de origem,
 * e resultado/impacto registados no giro que resolveu o ciclo.
 */
export function montarCSVCatalogacao(
  spins: Spin[],
  bips: Record<string, TipoBip>,
  signals: TrackedSignal[] = [],
): string {
  const ledger = loadSessionFinance();
  const bankroll = carregarConfigBanca();
  const rowsBySpin = new Map<number, TrackedSignal[]>();

  signals.forEach((signal) => {
    const resolutionIndex = signal.resultSpinId
      ? spins.findIndex((spin) => spin.id === signal.resultSpinId) + 1
      : signal.sourceIndex;
    const rowIndex = resolutionIndex > 0 ? resolutionIndex : signal.sourceIndex;
    const current = rowsBySpin.get(rowIndex) ?? [];
    current.push(signal);
    rowsBySpin.set(rowIndex, current);
  });

  const linhas = [CABECALHO];
  spins.forEach((spin, index) => {
    const c = spin.classificacao;
    const bip = bips[spin.id];
    const spinSignals = rowsBySpin.get(index + 1) ?? [];
    const strategies = spinSignals.map((signal) => signal.strategyLabel || signal.strategy).join(" | ");
    const targets = spinSignals.map((signal) => [signal.target, signal.deltaTarget].filter(Boolean).join(" + ")).join(" | ");
    const statuses = spinSignals.map(statusCSV).join(" | ");
    const impacts = spinSignals.map((signal) => {
      const result = effectiveSignalResult(signal, ledger);
      if (result === "NOT_PICKED" || result === "BLOCKED" || result === "GALE_BLOCKED") return 0;
      if (ledger.financialOverrides?.[signal.id] !== undefined) return ledger.financialOverrides[signal.id]!;
      return impactoFinanceiro(signal, bankroll, ledger);
    });
    const impactText = impacts.length
      ? impacts.map((value) => value === null ? "" : value.toFixed(2).replace(".", ",")).join(" | ")
      : "";
    const sourceIndexes = spinSignals.map((signal) => String(signal.sourceIndex)).join(" | ");
    linhas.push([
      index + 1,
      spin.numero,
      strategies || "NO_SIGNAL",
      targets,
      statuses || "NO_SIGNAL",
      impactText,
      sourceIndexes,
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
  signals: TrackedSignal[] = [],
): void {
  if (spins.length === 0) {
    window.alert("Nenhum dado para exportar");
    return;
  }
  const csv = montarCSVCatalogacao(spins, bips, signals);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const agora = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  link.href = url;
  link.download = `historico_sessao_completo_${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}_${pad(agora.getHours())}-${pad(agora.getMinutes())}.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
