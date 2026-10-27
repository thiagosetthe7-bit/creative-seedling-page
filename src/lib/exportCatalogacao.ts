import type { Spin } from "./roleta/catalogo";
import type { TipoBip } from "./roleta/store";
import type { TrackedSignal } from "./roleta/signalTracking";

const CABECALHO = "Spin_Index;Number;Terminal;Cavalo;High_Low;Dozen;Column;Even_Odd;Type;Section;Axis_0_10;Axis_22_34;Color;BR_Flag;BT_Flag;Triggered_Strategy;Target_Bet;Signal_Result;Post_Zero_Context;Last_Zero_Distance_Spins;Last_Zero_Spin_ID";

function celulaCSV(valor: unknown): string {
  const texto = String(valor ?? "");
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** Um registro por giro, em ordem cronológica, com as 14 áreas/flags e o desfecho dos sinais. */
export function montarCSVCatalogacao(
  spins: Spin[],
  bips: Record<string, TipoBip>,
  trackedSignals: TrackedSignal[] = [],
): string {
  const linhas = [CABECALHO];
  const bySourceSpin = new Map<string, TrackedSignal[]>();
  const byResultSpin = new Map<string, TrackedSignal[]>();
  for (const signal of trackedSignals) {
    const sourceList = bySourceSpin.get(signal.sourceSpinId) ?? [];
    sourceList.push(signal);
    bySourceSpin.set(signal.sourceSpinId, sourceList);
    if (signal.resultSpinId && signal.result !== "NO_SIGNAL") {
      const resultList = byResultSpin.get(signal.resultSpinId) ?? [];
      resultList.push(signal);
      byResultSpin.set(signal.resultSpinId, resultList);
    }
  }

  spins.forEach((spin, index) => {
    const c = spin.classificacao;
    const bip = bips[spin.id];
    const related = bySourceSpin.get(spin.id) ?? [];
    const strategy = related.map((signal) => {
      const ids = signal.confluence?.length ? signal.confluence : [signal.strategy === "bt-concomitante" ? signal.baseStrategy : signal.strategy].filter(Boolean) as NonNullable<TrackedSignal["baseStrategy"]>[];
      return ids.map((id) => id === "volt-duplo" ? "VOLT" : id === "delta" ? "DELTA" : id === "br-antecedente" ? "BR" : "None").filter((value) => value !== "None").join(" + ");
    }).filter(Boolean).join(" | ") || "None";
    const target = related.map((signal) => signal.target).join(" | ") || "";
    const postZero = related.find((signal) => signal.postZeroContext);
    const postZeroTag = postZero ? "POST_ZERO_CONFIRMED" : "NO";
    const postZeroDistance = postZero?.postZeroContext?.distance ?? "";
    const postZeroId = postZero?.postZeroContext?.zeroSpinId ?? "";
    const resolved = byResultSpin.get(spin.id) ?? [];
    const results = resolved.map((signal) => signal.result);
    const result = results.includes("GREEN_R1") ? "GREEN_R1"
      : results.includes("GREEN_GALE1") ? "GREEN_GALE1"
      : results.includes("RED") ? "RED" : "NO_SIGNAL";

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
      strategy,
      target,
      result,
      postZeroTag,
      postZeroDistance,
      postZeroId,
    ].map(celulaCSV).join(";"));
  });

  return "\uFEFF" + linhas.join("\r\n");
}

export function baixarCSVCatalogacao(
  spins: Spin[],
  bips: Record<string, TipoBip>,
  trackedSignals: TrackedSignal[] = [],
): void {
  if (spins.length === 0) {
    window.alert("Nenhum dado para exportar");
    return;
  }
  const csv = montarCSVCatalogacao(spins, bips, trackedSignals);
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
