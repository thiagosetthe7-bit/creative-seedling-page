import type { Spin } from "./catalogo";
import type { TipoBip } from "./store";

/** Motor VOLT Puro: analisa somente dúzias e colunas na janela recente. */
export type StrategyId = "volt-duplo" | "delta" | "volt-delta";
export interface EntrySignal {
  id: string;
  strategy: StrategyId;
  name: string;
  target: string;
  explanation: string;
  action: string;
  sourceSpinId: string;
  phase?: "R1" | "GALE1";
  deltaTarget?: string;
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
const MAX_INERTIAL_STREAK = 5;
const ANTI_ENTROPY_WINDOW = 6;
const DELTA_STREAK_MIN = 5;

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
/** Conta a sequência consecutiva do mesmo valor no fim da amostra. */
function trailingStreak(values: string[]): number {
  if (!values.length) return 0;
  const last = values[values.length - 1];
  let count = 0;
  for (let i = values.length - 1; i >= 0 && values[i] === last; i -= 1) count += 1;
  return count;
}

/** Bloqueia rotação perfeita C1→C2→C3 (ou D1→D2→D3) nas últimas seis rodadas. */
function isPerfectThreeWayRotation(spins: Spin[], axis: Axis): boolean {
  const recent = spins.slice(-ANTI_ENTROPY_WINDOW);
  if (recent.length < ANTI_ENTROPY_WINDOW || recent.some((spin) => spin.numero === 0)) return false;
  const values = recent.map((spin) => spin.classificacao[axis]);
  if (values.some((value) => value === "ZERO")) return false;
  const cycle = [...new Set(values)];
  if (cycle.length !== 3) return false;
  return values.every((value, index) => index < 3 || value === values[index - 3])
    && values.every((value, index) => index === 0 || value !== values[index - 1]);
}

type DeltaAxis = "cor" | "pi" | "ab";

/**
 * DELTA estrita: exige uma streak anterior de 5+ resultados iguais,
 * seguida por uma quebra e pelo retorno ao valor original.
 * A sequência é contada para trás a partir do giro imediatamente anterior à quebra.
 */
function evaluateDeltaAxis(spins: Spin[], axis: DeltaAxis): EntrySignal | null {
  const zeroIndex = lastZeroIndex(spins);
  const history = spins.slice(zeroIndex + 1).slice(-WINDOW_SIZE);
  if (history.length < DELTA_STREAK_MIN + 2) return null;
  if (history.some((spin) => spin.numero === 0) || history.at(-1)?.numero === 0) return null;

  const values = history.map((spin) => spin.classificacao[axis]);
  const targetValue = values[values.length - 1];
  const breakValue = values[values.length - 2];
  if (!targetValue || targetValue === "ZERO" || targetValue === "VERDE") return null;
  if (!breakValue || breakValue === "ZERO" || breakValue === "VERDE" || breakValue === targetValue) return null;

  // Conta a streak real imediatamente ANTES da quebra e do retorno.
  let streakCount = 0;
  for (let i = values.length - 3; i >= 0; i -= 1) {
    if (values[i] === targetValue) streakCount += 1;
    else break;
  }
  if (streakCount < DELTA_STREAK_MIN) return null;

  const labels: Record<DeltaAxis, string> = {
    cor: "COR",
    pi: "PAR/ÍMPAR",
    ab: "ALTO/BAIXO",
  };
  const target = `${labels[axis]} ${targetValue}`;
  const source = history[history.length - 1]!;
  return {
    id: `delta:${axis}:${source.id}:${targetValue}`,
    strategy: "delta",
    name: "DELTA",
    target,
    explanation: `DELTA ${labels[axis]}: ${streakCount} repetições consecutivas, quebra e retorno observados.`,
    action: `Avaliar ${target} no próximo giro. Padrões observados não garantem resultados.`,
    sourceSpinId: source.id,
  };
}

function evaluateAxis(spins: Spin[], axis: Axis): EntrySignal | null {
  const zeroIndex = lastZeroIndex(spins);
  const history = spins.slice(zeroIndex + 1).slice(-WINDOW_SIZE);
  // 3–5 repetições + uma quebra + retorno exigem pelo menos 5 giros.
  if (history.length < 5 || history.at(-1)?.numero === 0) return null;
  if (isPerfectThreeWayRotation(history, axis)) return null;

  const values = history.map((spin) => spin.classificacao[axis]);
  const targetValue = values[values.length - 1];
  const breakValue = values[values.length - 2];
  if (!targetValue || targetValue === "ZERO") return null;
  if (!breakValue || breakValue === "ZERO" || breakValue === targetValue) return null;

  // Conta a streak imediatamente anterior à quebra e ao retorno.
  let streakCount = 0;
  for (let i = values.length - 3; i >= 0; i -= 1) {
    if (values[i] === targetValue) streakCount += 1;
    else break;
  }
  if (streakCount < 3 || streakCount > 5) return null;

  const label = axis === "duzia" ? "DÚZIAS" : "COLUNAS";
  const target = `${label} ${targetValue}`;
  const source = history[history.length - 1]!;
  return {
    id: `volt-inercia:${axis}:${source.id}:${targetValue}`,
    strategy: "volt-duplo",
    name: "VOLT",
    target,
    explanation: `VOLT: ${streakCount} repetições consecutivas de ${targetValue}, uma quebra e retorno observados.`,
    action: `Entrada sugerida para o próximo giro (R1): apostar em ${targetValue}. Padrão observado não garante o resultado.`,
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
  // VOLT é a estratégia estrutural prioritária: preservar candidatos de ambos os eixos.
  const voltCandidates = [column, dozen].filter((signal): signal is EntrySignal => signal !== null);
  const volt = column ?? dozen;
  const delta = (["cor", "pi", "ab"] as const).map((axis) => evaluateDeltaAxis(spins, axis)).find((signal) => signal !== null) ?? null;

  // Se qualquer eixo VOLT validou o padrão, DELTA nunca sai isolada.
  // Quando DELTA também valida no mesmo giro, consolidamos os alvos em um único sinal.
  if (voltCandidates.length > 0 && volt) {
    if (!delta) return [volt];
    return [{
      ...volt,
      id: `volt-delta:${volt.sourceSpinId}:${delta.id}`,
      strategy: "volt-delta",
      name: "VOLT + DELTA",
      deltaTarget: delta.target,
      explanation: `${volt.explanation} Convergência DELTA: ${delta.target}.`,
      action: `Alvos simultâneos: ${volt.target} e ${delta.target} no próximo giro.`,
    }];
  }

  // Só permitir DELTA pura quando nenhum padrão VOLT foi validado neste giro.
  if (delta) return [delta];
  return [];
}
export function isSuperGatilho(_signals: EntrySignal[]): boolean { return false; }
