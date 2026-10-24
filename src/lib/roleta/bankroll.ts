import type { TrackedSignal } from "./signalTracking";

export type MetaMode = "valor" | "percentual";
export interface BankrollConfig {
  bancaInicial: number;
  metaModo: MetaMode;
  metaValor: number;
  metaPercentual: number;
  lucroAlvoPorEntrada: number;
  stopLossMaximo: number;
  stakeR1PorArea: number;
  stakeR2PorArea: number;
}
export const BANKROLL_KEY = "roleta-bankroll-config-v1";
export const DEFAULT_BANKROLL_CONFIG: BankrollConfig = {
  bancaInicial: 100,
  metaModo: "valor",
  metaValor: 10,
  metaPercentual: 10,
  lucroAlvoPorEntrada: 2.5,
  stopLossMaximo: 15,
  stakeR1PorArea: 2.5,
  stakeR2PorArea: 5,
};
export interface BankrollSummary {
  lucroLiquido: number;
  bancaAtual: number;
  metaFinanceira: number;
  progressoMeta: number;
  greens: number;
  reds: number;
  metaBatida: boolean;
  stopLossCritico: boolean;
}
export function getMetaFinanceira(config: BankrollConfig): number {
  return config.metaModo === "percentual"
    ? Math.max(0, config.bancaInicial * config.metaPercentual / 100)
    : Math.max(0, config.metaValor);
}
export function calcularBanca(signals: TrackedSignal[], config: BankrollConfig): BankrollSummary {
  const resolved = signals.filter((s) => s.status === "CONCLUÍDO" && (s.result === "GREEN_R1" || s.result === "GREEN_GALE1" || s.result === "RED"));
  // Cada sinal é contabilizado uma única vez pelo seu próprio ID; somente resultados concluídos entram no saldo.
  const unique = [...new Map(resolved.map((s) => [s.id, s])).values()];
  const greens = unique.filter((s) => s.result === "GREEN_R1" || s.result === "GREEN_GALE1").length;
  const reds = unique.filter((s) => s.result === "RED").length;
  const lucroLiquido = greens * config.lucroAlvoPorEntrada - reds * config.stopLossMaximo;
  const metaFinanceira = getMetaFinanceira(config);
  return {
    lucroLiquido,
    bancaAtual: config.bancaInicial + lucroLiquido,
    metaFinanceira,
    progressoMeta: metaFinanceira > 0 ? Math.max(0, Math.min(100, lucroLiquido / metaFinanceira * 100)) : 0,
    greens,
    reds,
    metaBatida: metaFinanceira > 0 && lucroLiquido >= metaFinanceira,
    stopLossCritico: lucroLiquido <= -Math.abs(config.stopLossMaximo),
  };
}
export function carregarConfigBanca(): BankrollConfig {
  if (typeof window === "undefined") return DEFAULT_BANKROLL_CONFIG;
  try {
    const raw = window.localStorage.getItem(BANKROLL_KEY);
    return raw ? { ...DEFAULT_BANKROLL_CONFIG, ...(JSON.parse(raw) as Partial<BankrollConfig>) } : DEFAULT_BANKROLL_CONFIG;
  } catch {
    return DEFAULT_BANKROLL_CONFIG;
  }
}
