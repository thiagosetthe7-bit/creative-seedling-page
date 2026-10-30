import type { Spin } from "./catalogo";
import type { TipoBip } from "./store";
import type { EntrySignal, StrategyId } from "./signalEngine";

/** Tipos mantidos temporariamente para compatibilidade; a análise automática está desativada. */
export type SmartGaleStatus = "APPROVED" | "BLOCKED";
export interface SmartGaleDecision {
  id: string;
  signalId: string;
  strategy: StrategyId;
  status: SmartGaleStatus;
  r1Number: number;
  title: string;
  reason: string;
  galeLevel: 1;
}

/** Template neutro: não analisa resultados nem aprova/bloqueia reentradas. */
export function avaliarSmartGale1(_spins: Spin[], _bips: Record<string, TipoBip>): SmartGaleDecision | null {
  return null;
}

/** Compatibilidade para consumidores antigos. */
export function hitSignal(_signal: EntrySignal, _spin: Spin): boolean {
  return false;
}
