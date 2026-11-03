import type { Spin } from "./roleta/catalogo";
import type { TipoBip } from "./roleta/store";
import type { TrackedSignal } from "./roleta/signalTracking";
import { carregarConfigBanca } from "./roleta/bankroll";
import { effectiveSignalResult, impactoFinanceiro, loadSessionFinance } from "./roleta/sessionFinance";

const CABECALHO = "Spin_Index;Timestamp;Number;Terminal;Cavalo;High_Low;Dozen;Column;Even_Odd;Type;Section;Axis_0_10;Axis_22_34;Color;Triggered_Strategy;Target_Bet;Signal_Source_Spin_Index;Signal_Status;Execution_Mode;Financial_Impact;Running_Bankroll";

function celulaCSV(valor: unknown): string {
  const texto = String(valor ?? "");
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function statusCSV(signal: TrackedSignal, ledger: ReturnType<typeof loadSessionFinance>): string {
  const result = effectiveSignalResult(signal, ledger);
  // Pré-catalogação mantém "Não Peguei" como estado financeiro, mas exporta
  // também o desfecho técnico calculado pelo motor para auditoria da mesa.
  if (signal.preCatalog && result === "NOT_PICKED") {
    if (signal.result === "GREEN_R1" || signal.result === "GREEN_GALE1") return "Pré-Catalogação • Green";
    if (signal.result === "RED") return "Pré-Catalogação • Red";
    if (signal.result === "GALE_BLOCKED") return "Pré-Catalogação • Gale Bloqueado";
    return "Não Peguei";
  }
  const labels: Record<string, string> = {
    GREEN_R1: "Green R1",
    GREEN_GALE1: "Green Gale 1",
    RED: "Red",
    GALE_BLOCKED: "Gale Bloqueado",
    BLOCKED: "Gale Bloqueado",
    NOT_PICKED: "Não Peguei",
    PENDING: "Pendente",
    NO_SIGNAL: "Pendente",
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
  // Cada sinal pertence à linha do giro em que foi GERADO, não ao giro
  // posterior que resolveu R1/Gale 1. Assim sinais pendentes e pré-catalogados
  // nunca desaparecem do CSV.
  const rowsBySpin = new Map<number, TrackedSignal[]>();
  signals.forEach((signal) => {
    const rowIndex = signal.sourceIndex;
    if (!Number.isInteger(rowIndex) || rowIndex < 1 || rowIndex > spins.length) return;
    const current = rowsBySpin.get(rowIndex) ?? [];
    current.push(signal);
    rowsBySpin.set(rowIndex, current);
  });

  const linhas = [CABECALHO];
  let runningBankroll = bankroll.bancaInicial;
  spins.forEach((spin, index) => {
    const c = spin.classificacao;
    const spinSignals = rowsBySpin.get(index + 1) ?? [];
    const strategies = spinSignals.map((signal) => signal.strategyLabel || signal.strategy).join(" | ");
    const targets = spinSignals.map((signal) => [signal.target, signal.deltaTarget].filter(Boolean).join(" + ")).join(" | ");
    const statuses = spinSignals.map((signal) => statusCSV(signal, ledger)).join(" | ");
    const impacts = spinSignals.map((signal) => {
      const result = effectiveSignalResult(signal, ledger);
      if (result === "NOT_PICKED" || result === "BLOCKED" || result === "GALE_BLOCKED") return 0;
      if (ledger.financialOverrides?.[signal.id] !== undefined) return ledger.financialOverrides[signal.id]!;
      return impactoFinanceiro(signal, bankroll, ledger) ?? 0;
    });
    // Impacto e saldo são apresentados por giro de origem do sinal.
    const financialImpact = impacts.reduce((sum, value) => sum + value, 0);
    runningBankroll += financialImpact;
    const executionMode = spinSignals.some((signal) => {
      const result = effectiveSignalResult(signal, ledger);
      return !signal.preCatalog && result !== "NOT_PICKED" && result !== "BLOCKED" && result !== "GALE_BLOCKED";
    }) ? "Operada" : "Monitoramento";
    const sourceIndexes = spinSignals.map((signal) => String(signal.sourceIndex)).join(" | ");
    linhas.push([
      index + 1,
      new Date(spin.timestamp).toISOString(),
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
      strategies || "NO_SIGNAL",
      targets,
      sourceIndexes,
      statuses || "NO_SIGNAL",
      executionMode,
      financialImpact.toFixed(2),
      runningBankroll.toFixed(2),
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
