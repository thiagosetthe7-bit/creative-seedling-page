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
  metaDiariaPercentual: number;
  periodoDias: number;
  stakePercentual: number;
  bloquearSinaisMetaDiaria: boolean;
  dataInicio: string;
}
export const BANKROLL_KEY = "roleta-bankroll-config-v1";
export const BANKROLL_DAYS_KEY = "roleta-bankroll-days-v1";
export const DEFAULT_BANKROLL_CONFIG: BankrollConfig = {
  bancaInicial: 100,
  metaModo: "valor",
  metaValor: 10,
  metaPercentual: 10,
  lucroAlvoPorEntrada: 2.5,
  stopLossMaximo: 15,
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
export interface DailyRecord { resultadoRealizado: number | null; bancaInicialOverride?: number | null; }
export interface DailyRow {
  dia: number;
  data: string;
  bancaInicial: number;
  metaDia: number;
  resultadoRealizado: number | null;
  bancaFinal: number | null;
  status: "META_ATINGIDA" | "PARCIAL" | "STOP_LOSS" | "PENDENTE";
}
export const dinheiro = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
export function getMetaFinanceira(config: BankrollConfig): number {
  return config.metaModo === "percentual" ? Math.max(0, config.bancaInicial * config.metaPercentual / 100) : Math.max(0, config.metaValor);
}
export function calcularBanca(signals: TrackedSignal[], config: BankrollConfig): BankrollSummary {
  const resolved = signals.filter((s) => s.status === "CONCLUÍDO" && (s.result === "GREEN_R1" || s.result === "GREEN_GALE1" || s.result === "RED"));
  const unique = [...new Map(resolved.map((s) => [s.id, s])).values()];
  const greens = unique.filter((s) => s.result === "GREEN_R1" || s.result === "GREEN_GALE1").length;
  const reds = unique.filter((s) => s.result === "RED").length;
  const lucroLiquido = greens * config.lucroAlvoPorEntrada - reds * config.stopLossMaximo;
  const metaFinanceira = getMetaFinanceira(config);
  return { lucroLiquido, bancaAtual: config.bancaInicial + lucroLiquido, metaFinanceira, progressoMeta: metaFinanceira > 0 ? Math.max(0, Math.min(100, lucroLiquido / metaFinanceira * 100)) : 0, greens, reds, metaBatida: metaFinanceira > 0 && lucroLiquido >= metaFinanceira, stopLossCritico: lucroLiquido <= -Math.abs(config.stopLossMaximo) };
}
export function carregarConfigBanca(): BankrollConfig {
  if (typeof window === "undefined") return DEFAULT_BANKROLL_CONFIG;
  try {
    const raw = window.localStorage.getItem(BANKROLL_KEY);
    return raw ? { ...DEFAULT_BANKROLL_CONFIG, ...(JSON.parse(raw) as Partial<BankrollConfig>) } : DEFAULT_BANKROLL_CONFIG;
  } catch { return DEFAULT_BANKROLL_CONFIG; }
}
export function carregarDiasBanca(): Record<number, DailyRecord> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(BANKROLL_DAYS_KEY) || "{}") as Record<number, DailyRecord>; } catch { return {}; }
}
export function dataDia(dataInicio: string, dia: number): string {
  const date = new Date(dataInicio + "T12:00:00");
  date.setDate(date.getDate() + dia - 1);
  return date.toISOString().slice(0, 10);
}
export function diaAtivo(config: BankrollConfig, hoje = new Date().toISOString().slice(0, 10)): number {
  const start = new Date(config.dataInicio + "T00:00:00").getTime();
  const current = new Date(hoje + "T00:00:00").getTime();
  return Math.floor((current - start) / 86400000) + 1;
}
export function calcularTabelaJuros(config: BankrollConfig, records: Record<number, DailyRecord>, hoje = new Date().toISOString().slice(0, 10)): DailyRow[] {
  const n = Math.max(1, Math.min(3650, Math.floor(config.periodoDias || 1)));
  let saldo = Math.max(0, config.bancaInicial);
  const activeDay = diaAtivo(config, hoje);
  const rows: DailyRow[] = [];
  for (let dia = 1; dia <= n; dia += 1) {
    const override = records[dia]?.bancaInicialOverride;
    const bancaInicial = override !== undefined && override !== null && Number.isFinite(override) ? Math.max(0, override) : saldo;
    const metaDia = bancaInicial * Math.max(0, config.metaDiariaPercentual) / 100;
    const registro = records[dia];
    const resultadoRealizado = registro?.resultadoRealizado ?? null;
    const passadoOuHoje = dia <= activeDay;
    const status: DailyRow["status"] = resultadoRealizado === null ? "PENDENTE" : resultadoRealizado <= -Math.abs(config.stopLossMaximo) ? "STOP_LOSS" : resultadoRealizado >= metaDia ? "META_ATINGIDA" : "PARCIAL";
    const bancaFinal = resultadoRealizado === null ? (passadoOuHoje ? bancaInicial : null) : Math.max(0, bancaInicial + resultadoRealizado);
    rows.push({ dia, data: dataDia(config.dataInicio, dia), bancaInicial, metaDia, resultadoRealizado, bancaFinal, status });
    // Futuro sem resultado fica projetado com a meta diária composta.
    saldo = resultadoRealizado === null ? (passadoOuHoje ? bancaInicial : bancaInicial + metaDia) : Math.max(0, bancaInicial + resultadoRealizado);
  }
  return rows;
}
export function projetarJurosCompostos(bancaInicial: number, metaPercentual: number, dias: number): number {
  return Math.max(0, bancaInicial) * Math.pow(1 + Math.max(0, metaPercentual) / 100, Math.max(0, Math.floor(dias)));
}
