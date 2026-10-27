import type { TrackedSignal } from "./signalTracking";

export type MetaMode = "valor" | "percentual";
export interface BankrollConfig {
  bancaInicial: number;
  metaModo: MetaMode;
  metaValor: number;
  metaPercentual: number;
  lucroAlvoPorEntrada: number;
  stopLossMaximo: number;
  stopLossPercentual: number;
  stakeR1PorArea: number;
  stakeR2PorArea: number;
  metaDiariaPercentual: number;
  periodoDias: number;
  stakePercentual: number;
  bloquearSinaisMetaDiaria: boolean;
  dataInicio: string;
}
export const BANKROLL_KEY = "roleta-bankroll-config-v1";
export const DEFAULT_BANKROLL_CONFIG: BankrollConfig = {
  bancaInicial: 100,
  metaModo: "valor",
  metaValor: 10,
  metaPercentual: 10,
  lucroAlvoPorEntrada: 2.5,
  stopLossMaximo: 15,
  stopLossPercentual: 20,
  stakeR1PorArea: 2.5,
  stakeR2PorArea: 5,
  metaDiariaPercentual: 5,
  periodoDias: 30,
  stakePercentual: 2.5,
  bloquearSinaisMetaDiaria: false,
  dataInicio: new Date().toISOString().slice(0, 10),
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
export const dinheiro = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
export function getMetaFinanceira(config: BankrollConfig): number {
  return config.metaModo === "percentual" ? Math.max(0, config.bancaInicial * config.metaDiariaPercentual / 100) : Math.max(0, config.metaValor);
}
export function calcularBanca(signals: TrackedSignal[], config: BankrollConfig): BankrollSummary {
  const resolved = signals.filter((s) => s.status === "CONCLUÍDO" && (s.result === "GREEN_R1" || s.result === "GREEN_GALE1" || s.result === "RED"));
  const unique = [...new Map(resolved.map((s) => [s.id, s])).values()];
  const greens = unique.filter((s) => s.result === "GREEN_R1").length;
  const reds = unique.filter((s) => s.result === "RED").length;
  const lucroLiquido = greens * config.stakeR1PorArea - reds * (config.stakeR1PorArea * 6);
  const stopLossAtivo = Math.max(0, config.bancaInicial * (config.stopLossPercentual ?? 20) / 100);
  const metaFinanceira = getMetaFinanceira(config);
  return { lucroLiquido, bancaAtual: config.bancaInicial + lucroLiquido, metaFinanceira, progressoMeta: metaFinanceira > 0 ? Math.max(0, Math.min(100, lucroLiquido / metaFinanceira * 100)) : 0, greens, reds, metaBatida: metaFinanceira > 0 && lucroLiquido >= metaFinanceira, stopLossCritico: reds > 0 && lucroLiquido <= -Math.abs(stopLossAtivo) };
}
export function carregarConfigBanca(): BankrollConfig {
  if (typeof window === "undefined") return DEFAULT_BANKROLL_CONFIG;
  try {
    const raw = window.localStorage.getItem(BANKROLL_KEY);
    return raw ? { ...DEFAULT_BANKROLL_CONFIG, ...(JSON.parse(raw) as Partial<BankrollConfig>) } : DEFAULT_BANKROLL_CONFIG;
  } catch { return DEFAULT_BANKROLL_CONFIG; }
}
export function diaAtivo(config: BankrollConfig, hoje = new Date().toISOString().slice(0, 10)): number {
  const start = new Date(config.dataInicio + "T00:00:00").getTime();
  const current = new Date(hoje + "T00:00:00").getTime();
  return Math.floor((current - start) / 86400000) + 1;
}
