export type MetaMode = "valor" | "percentual";
export interface BankrollConfig {
  bancaInicial: number;
  metaModo: MetaMode;
  metaValor: number;
  metaPercentual: number;
  metaDiariaPercentual: number;
  stopLossPercentual: number;
  bloquearSinaisMetaDiaria: boolean;
  dataInicio: string;
  dataResetDia?: string;
  resetTimestamp?: number;
  bancaResetDia?: number;
}
export const BANKROLL_KEY = "roleta-bankroll-config-v1";
export const DEFAULT_BANKROLL_CONFIG: BankrollConfig = {
  bancaInicial: 100, metaModo: "valor", metaValor: 10, metaPercentual: 10,
  metaDiariaPercentual: 5, stopLossPercentual: 20, bloquearSinaisMetaDiaria: false,
  dataInicio: new Date().toISOString().slice(0, 10),
};
export const dinheiro = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
export function getMetaFinanceira(config: BankrollConfig): number {
  return config.metaModo === "percentual" ? Math.max(0, config.bancaInicial * config.metaDiariaPercentual / 100) : Math.max(0, config.metaValor);
}
export function carregarConfigBanca(): BankrollConfig {
  if (typeof window === "undefined") return DEFAULT_BANKROLL_CONFIG;
  try { const raw = window.localStorage.getItem(BANKROLL_KEY); return raw ? { ...DEFAULT_BANKROLL_CONFIG, ...(JSON.parse(raw) as Partial<BankrollConfig>) } : DEFAULT_BANKROLL_CONFIG; }
  catch { return DEFAULT_BANKROLL_CONFIG; }
}
export function diaAtivo(config: BankrollConfig, hoje = new Date().toISOString().slice(0, 10)): number {
  const start = new Date(config.dataInicio + "T00:00:00").getTime();
  const current = new Date(hoje + "T00:00:00").getTime();
  return Math.floor((current - start) / 86400000) + 1;
}
