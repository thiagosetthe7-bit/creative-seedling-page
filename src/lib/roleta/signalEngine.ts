import type { Spin } from "./catalogo";
import type { TipoBip } from "./store";

/** Motor VOLT Puro: analisa somente dúzias e colunas na janela recente. */
export type StrategyId = "volt-duplo";
export interface EntrySignal {
  id: string;
  strategy: StrategyId;
  name: string;
  target: string;
  explanation: string;
  action: string;
  sourceSpinId: string;
}
export const ZERO_COOLOFF_SPINS = 0;
export interface MarketEntropyAssessment {
  isMarketSafe: boolean;
  dominantSector: string | null;
  concentration: number;
  hasIsolatedBreaks: boolean;
}
const WINDOW_SIZE = 20;
const MIN_DOMINANCE = 5;

type Axis = "duzia" | "coluna";
type Pair = [string, string];

function lastZeroIndex(spins: Spin[]): number {
  for (let i = spins.length - 1; i >= 0; i -= 1) if (spins[i]?.numero === 0) return i;
  return -1;
}
function bestPair(spins: Spin[], axis: Axis): Pair | null {
  const counts = new Map<string, number>();
  for (const spin of spins) {
    const value = spin.classificacao[axis];
    if (value === "ZERO") continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (sorted.length < 2) return null;
  return [sorted[0]![0], sorted[1]![0]];
}
function evaluateAxis(spins: Spin[], axis: Axis): EntrySignal | null {
  if (spins.length < 7) return null;
  const zeroIndex = lastZeroIndex(spins);
  const afterZero = spins.slice(zeroIndex + 1);
  const window = afterZero.slice(-WINDOW_SIZE);
  if (window.length < 7 || window[window.length - 1]?.numero === 0) return null;
  const pair = bestPair(window.slice(0, -1), axis);
  if (!pair) return null;
  const values = window.map((spin) => spin.classificacao[axis]);
  const last = values.slice(-7);
  // 5+ giros na dupla, exatamente uma quebra, seguida de retorno à dupla.
  const beforeBreak = last.slice(0, -2);
  const breakValue = last[last.length - 2];
  const returned = last[last.length - 1];
  const dominantCount = beforeBreak.filter((v) => pair.includes(v)).length;
  const breakIsOutside = !pair.includes(breakValue!);
  if (dominantCount < MIN_DOMINANCE || !breakIsOutside || !pair.includes(returned!)) return null;
  const label = axis === "duzia" ? "DÚZIAS" : "COLUNAS";
  const target = `${label} ${pair[0]} + ${pair[1]}`;
  const source = window[window.length - 1]!;
  return {
    id: `volt-puro:${axis}:${source.id}:${pair.join("-")}`,
    strategy: "volt-duplo",
    name: "VOLT PURO",
    target,
    explanation: `Janela de até ${WINDOW_SIZE} giros após o zero mais recente: dominância da dupla, uma quebra isolada e retorno observado.`,
    action: `Entrada sugerida para o próximo giro (R1): apostar em ${pair[0]} e ${pair[1]}. Padrão observado não garante o resultado.`,
    sourceSpinId: source.id,
  };
}

export function checkColumnDozenStagnation(history: { Column: string; Dozen: string }[]): boolean {
  return history.length >= MIN_DOMINANCE;
}
export function hasStrictColumnDozenStagnation(spins: Spin[], minimumRun = 4): boolean {
  const recent = spins.slice(-Math.max(minimumRun, 1));
  return recent.length >= minimumRun && recent.every((spin) => spin.numero !== 0);
}
export function shouldBlockGale1(_spins: Spin[]): boolean { return false; }
export function evaluateEvenOddAlternation(_history: { Even_Odd: string }[]): boolean { return false; }
export function isZeroInPatternWindow(spins: Spin[], windowSize = 5): boolean {
  return spins.slice(-windowSize).some((spin) => spin.numero === 0);
}
export function isPostZeroQuarantineActive(_spins: Spin[]): boolean { return false; }
export function evaluateMarketEntropy(spins: Spin[]): MarketEntropyAssessment {
  const recent = spins.slice(-WINDOW_SIZE);
  return { isMarketSafe: true, dominantSector: null, concentration: recent.length ? recent.length / WINDOW_SIZE : 0, hasIsolatedBreaks: false };
}
export function detectarReentradaAposZero(spins: Spin[], _bips: Record<string, TipoBip>): EntrySignal[] {
  return spins.at(-1)?.numero === 0 ? [] : detectarSinaisEntrada(spins, {});
}
export function detectarSinaisEntrada(spins: Spin[], _bips: Record<string, TipoBip>): EntrySignal[] {
  if (!spins.length || spins.at(-1)?.numero === 0) return [];
  const dozen = evaluateAxis(spins, "duzia");
  const column = evaluateAxis(spins, "coluna");
  // Prioriza coluna quando os dois eixos confirmam no mesmo giro, evitando duplicação.
  return column ? [column] : dozen ? [dozen] : [];
}
export function isSuperGatilho(_signals: EntrySignal[]): boolean { return false; }
