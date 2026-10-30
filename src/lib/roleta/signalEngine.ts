import type { Spin } from "./catalogo";
import type { TipoBip } from "./store";

/**
 * TEMPLATE LIMPO DO MOTOR DE SINAIS
 *
 * Este módulo está intencionalmente desativado. Não contém regras, gatilhos,
 * contadores, filtros, estratégias ou recomendações. Todas as funções de
 * detecção retornam valores neutros para manter compatibilidade com módulos
 * antigos enquanto a catalogação bruta é reconstruída.
 *
 * Quando uma nova implementação for aprovada, ela deverá ser adicionada aqui
 * explicitamente. O tratamento do número zero permanece na classificação e na
 * catalogação, fora deste motor.
 */

// Mantido apenas como tipo de compatibilidade para módulos antigos.
export type StrategyId = "volt-duplo" | "delta" | "br-antecedente" | "bt-concomitante";

export interface EntrySignal {
  id: string;
  strategy: StrategyId;
  name: string;
  target: string;
  explanation: string;
  action: string;
  sourceSpinId: string;
  baseStrategy?: StrategyId | undefined;
  confluence?: StrategyId[] | undefined;
  postZeroContext?: { zeroSpinId: string; distance: number } | undefined;
  evenOddConfluence?: "high" | "standard" | "dispersion" | undefined;
  evenOddWindow?: string[] | undefined;
}

export const ZERO_COOLOFF_SPINS = 0;

export function checkColumnDozenStagnation(_history: { Column: string; Dozen: string }[]): boolean {
  return true;
}

export function hasStrictColumnDozenStagnation(_spins: Spin[], _minimumRun = 4): boolean {
  return false;
}

export function shouldBlockGale1(_spins: Spin[]): boolean {
  return false;
}

export function evaluateEvenOddAlternation(_history: { Even_Odd: string }[]): boolean {
  return false;
}

export function isZeroInPatternWindow(_spins: Spin[], _windowSize = 5): boolean {
  return false;
}

export function isPostZeroQuarantineActive(_spins: Spin[]): boolean {
  return false;
}

export interface MarketEntropyAssessment {
  isMarketSafe: boolean;
  dominantSector: string | null;
  concentration: number;
  hasIsolatedBreaks: boolean;
}

export function evaluateMarketEntropy(_spins: Spin[]): MarketEntropyAssessment {
  return { isMarketSafe: true, dominantSector: null, concentration: 0, hasIsolatedBreaks: false };
}

export function detectarReentradaAposZero(_spins: Spin[], _bips: Record<string, TipoBip>): EntrySignal[] {
  return [];
}

export function detectarSinaisEntrada(_spins: Spin[], _bips: Record<string, TipoBip>): EntrySignal[] {
  return [];
}

export function isSuperGatilho(_signals: EntrySignal[]): boolean {
  return false;
}
