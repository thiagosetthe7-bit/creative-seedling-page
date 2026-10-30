import type { TrackedSignal, SignalResult } from "./signalTracking";
import type { BankrollConfig } from "./bankroll";

export type EditableSignalResult = SignalResult | "GREEN_GALE2" | "PENDING" | "NOT_PICKED" | "BLOCKED" | "GALE_BLOCKED" | "PARTIAL_RED";
export interface SessionFinanceLedger {
  removedSignalIds: string[];
  corrections: Record<string, EditableSignalResult>;
}
export const SESSION_FINANCE_KEY = "roleta-session-finance-v1";
export const SESSION_FINANCE_EVENT = "roleta:session-finance-updated";
export const EMPTY_SESSION_FINANCE: SessionFinanceLedger = { removedSignalIds: [], corrections: {} };

export function loadSessionFinance(): SessionFinanceLedger {
  if (typeof window === "undefined") return EMPTY_SESSION_FINANCE;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SESSION_FINANCE_KEY) || "null") as Partial<SessionFinanceLedger> | null;
    return {
      removedSignalIds: Array.isArray(parsed?.removedSignalIds) ? parsed.removedSignalIds : [],
      corrections: parsed?.corrections && typeof parsed.corrections === "object" ? parsed.corrections : {},
    };
  } catch { return EMPTY_SESSION_FINANCE; }
}
export function saveSessionFinance(ledger: SessionFinanceLedger): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_FINANCE_KEY, JSON.stringify(ledger));
    window.dispatchEvent(new CustomEvent(SESSION_FINANCE_EVENT));
  } catch { /* storage opcional */ }
}
export function effectiveSignalResult(signal: TrackedSignal, ledger: SessionFinanceLedger): EditableSignalResult {
  return ledger.corrections[signal.id] ?? (signal.result === "NO_SIGNAL" ? "PENDING" : signal.result);
}
/** Modelo explícito solicitado: GREEN R1 = +stake base; GREEN R2 = break-even; RED = perde R1+R2. */
export function impactoFinanceiro(signal: TrackedSignal, config: BankrollConfig, ledger: SessionFinanceLedger): number | null {
  if (ledger.removedSignalIds.includes(signal.id)) return null;
  const result = effectiveSignalResult(signal, ledger);
  if (result === "NOT_PICKED" || result === "BLOCKED" || result === "GALE_BLOCKED") return 0;
  if (result === "PARTIAL_RED") return -config.stakeR1PorArea;
  if (result === "PENDING" || result === "NO_SIGNAL") return null;
  if (result === "GREEN_R1") return config.stakeR1PorArea;
  if (result === "GREEN_GALE1" || result === "GREEN_GALE2") return 0;
  if (result === "RED") return -(config.stakeR1PorArea * 2 + config.stakeR1PorArea * 4);
  return null;
}
export function sinalRemovido(signalId: string, ledger: SessionFinanceLedger): boolean {
  return ledger.removedSignalIds.includes(signalId);
}
