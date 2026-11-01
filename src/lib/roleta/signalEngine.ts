import type { Spin } from "./catalogo";
import type { TipoBip } from "./store";

/** ENGINE RESET — tábula rasa. Mantém apenas contratos temporários de compatibilidade. */
export type StrategyId = "volt-duplo" | "delta" | "volt-delta";
export interface EntrySignal {
  id: string; strategy: StrategyId; name: string; target: string;
  explanation: string; action: string; sourceSpinId: string;
  phase?: "R1" | "GALE1"; deltaTarget?: string;
}
export interface MarketEntropyAssessment {
  isMarketSafe: boolean; dominantSector: string | null; concentration: number; hasIsolatedBreaks: boolean;
}
export const ZERO_COOLOFF_SPINS = 0;
export function checkColumnDozenStagnation(_history: { Column: string; Dozen: string }[]): boolean { return false; }
export function hasStrictColumnDozenStagnation(_spins: Spin[], _minimumRun = 4): boolean { return false; }
export function shouldBlockGale1(_spins: Spin[]): boolean { return false; }
export function evaluateEvenOddAlternation(_history: { Even_Odd: string }[]): boolean { return false; }
export function isZeroInPatternWindow(_spins: Spin[], _windowSize = 5): boolean { return false; }
export function isPostZeroQuarantineActive(_spins: Spin[]): boolean { return false; }
export function evaluateMarketEntropy(_spins: Spin[]): MarketEntropyAssessment {
  return { isMarketSafe: false, dominantSector: null, concentration: 0, hasIsolatedBreaks: false };
}
export function detectarReentradaAposZero(_spins: Spin[], _bips: Record<string, TipoBip>): EntrySignal[] { return []; }
export function detectarSinaisEntrada(_spins: Spin[], _bips: Record<string, TipoBip>): EntrySignal[] { return []; }
export function isSuperGatilho(_signals: EntrySignal[]): boolean { return false; }
