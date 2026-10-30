import type { Spin } from "./catalogo";
import type { TipoBip } from "./store";

export type StrategyId = "volt-duplo" | "delta" | "br-antecedente" | "bt-concomitante";

export interface EntrySignal {
  id: string;
  strategy: StrategyId;
  name: string;
  target: string;
  explanation: string;
  action: string;
  sourceSpinId: string;
  /** Estratégia cuja entrada é acompanhada pelo BT concomitante. */
  baseStrategy?: StrategyId | undefined;
  /** Todas as estratégias que confluíram neste único cartão/entrada. */
  confluence?: StrategyId[] | undefined;
  /** Contexto pós-zero validado: o ciclo completo de dominância, quebra e retorno ocorreu após o último zero. */
  postZeroContext?: { zeroSpinId: string; distance: number } | undefined;
  /** Confluência descritiva baseada nos quatro giros anteriores ao gatilho. */
  evenOddConfluence?: "high" | "standard" | "dispersion" | undefined;
  evenOddWindow?: string[] | undefined;
}

export const ZERO_COOLOFF_SPINS = 3;

/**
 * Returns false when the last three valid spins repeat one column or one dozen.
 * Missing history and ZERO values fail closed so a signal is not approved without
 * enough valid classification data. This is a risk filter, not a prediction.
 */
export function checkColumnDozenStagnation(history: { Column: string; Dozen: string }[]): boolean {
  if (history.length < 3) return false;
  const last3 = history.slice(-3);
  if (last3.some((spin) => !spin.Column || !spin.Dozen || spin.Column === "ZERO" || spin.Dozen === "ZERO")) return false;
  const isColumnStagnant = last3[0]!.Column === last3[1]!.Column && last3[1]!.Column === last3[2]!.Column;
  const isDozenStagnant = last3[0]!.Dozen === last3[1]!.Dozen && last3[1]!.Dozen === last3[2]!.Dozen;
  return !(isColumnStagnant || isDozenStagnant);
}

function hasColumnDozenStagnation(spins: Spin[]): boolean {
  const last3 = spins.slice(-3);
  if (last3.length < 3) return true;
  return !checkColumnDozenStagnation(last3.map((spin) => ({
    Column: spin.classificacao.coluna,
    Dozen: spin.classificacao.duzia,
  })));
}

/**
 * Detecta alternância estrita PAR/ÍMPAR nos quatro resultados mais recentes.
 * O resultado descreve o histórico observado; não estima nem garante ganhos futuros.
 */
export function evaluateEvenOddAlternation(history: { Even_Odd: string }[]): boolean {
  if (history.length < 4) return false;
  const last4 = history.slice(-4).map((item) => item.Even_Odd);
  return last4[0] !== last4[1] && last4[1] !== last4[2] && last4[2] !== last4[3];
}

function assessEvenOddConfluence(spins: Spin[], triggerIndex: number): Pick<EntrySignal, "evenOddConfluence" | "evenOddWindow"> {
  // Exclui o giro que disparou o sinal: são os quatro giros anteriores ao gatilho.
  const previous4 = spins.slice(Math.max(0, triggerIndex - 4), triggerIndex);
  const values = previous4.map((spin) => spin.classificacao.pi);
  if (previous4.length < 4 || values.some((value) => value !== "PAR" && value !== "IMPAR")) {
    return { evenOddConfluence: "standard", evenOddWindow: values };
  }
  if (evaluateEvenOddAlternation(values.map((Even_Odd) => ({ Even_Odd })))) {
    return { evenOddConfluence: "high", evenOddWindow: values };
  }
  if (values.every((value) => value === values[0])) {
    return { evenOddConfluence: "dispersion", evenOddWindow: values };
  }
  return { evenOddConfluence: "standard", evenOddWindow: values };
}

/** True when a zero appears inside the recent window used to form a signal. */
export function isZeroInPatternWindow(spins: Spin[], windowSize = 5): boolean {
  if (spins.length < windowSize) return true;
  return spins.slice(-windowSize).some((spin) => spin.numero === 0);
}

/**
 * Zero quarantine: the zero itself plus the next three spins are signal-free.
 * The first eligible spin is the fourth spin after zero, and its five-spin
 * pattern window must also be free of zero.
 */
export function isPostZeroQuarantineActive(spins: Spin[]): boolean {
  let lastZeroIndex = -1;
  for (let i = spins.length - 1; i >= 0; i -= 1) {
    if (spins[i]?.numero === 0) { lastZeroIndex = i; break; }
  }
  if (lastZeroIndex === -1) return false;
  const spinsSinceZero = spins.length - 1 - lastZeroIndex;
  return spinsSinceZero < ZERO_COOLOFF_SPINS;
}

export interface MarketEntropyAssessment {
  isMarketSafe: boolean;
  dominantSector: string | null;
  concentration: number;
  hasIsolatedBreaks: boolean;
}

/**
 * Defensive market filter over the last 10 catalogued spins.
 * A sector is considered saturated at 6/10 or more, and chaotic when at least
 * one single-spin interruption is surrounded by the same dominant sector.
 * Zero is excluded from sector counts and interrupts a run.
 */
export function evaluateMarketEntropy(spins: Spin[]): MarketEntropyAssessment {
  const last10 = spins.slice(-10);
  if (last10.length < 10) {
    return { isMarketSafe: true, dominantSector: null, concentration: 0, hasIsolatedBreaks: false };
  }

  const dimensions: { key: AreaKey; label: string }[] = [
    { key: "duzia", label: "DÚZIA" },
    { key: "coluna", label: "COLUNA" },
  ];
  let dominantSector: string | null = null;
  let maxCount = 0;
  let dominantValues = new Set<string>();

  for (const dimension of dimensions) {
    const counts = new Map<string, number>();
    for (const spin of last10) {
      const value = valueOf(spin, dimension.key);
      if (value === "ZERO" || value === "VERDE") continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    for (const [value, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        dominantSector = `${dimension.label} ${value}`;
        dominantValues = new Set([value]);
      }
    }
  }

  if (maxCount < 6 || !dominantSector) {
    return { isMarketSafe: true, dominantSector, concentration: maxCount / 10, hasIsolatedBreaks: false };
  }

  const isDominant = (spin: Spin) => {
    const [dimensionLabel, value] = dominantSector!.split(" ");
    const key: AreaKey = dimensionLabel === "DÚZIA" ? "duzia" : "coluna";
    return valueOf(spin, key) === value;
  };
  let hasIsolatedBreaks = false;
  for (let i = 1; i < last10.length - 1; i += 1) {
    if (!isDominant(last10[i]!) && isDominant(last10[i - 1]!) && isDominant(last10[i + 1]!)) {
      hasIsolatedBreaks = true;
      break;
    }
  }

  return {
    isMarketSafe: !(maxCount >= 6 && hasIsolatedBreaks),
    dominantSector,
    concentration: maxCount / 10,
    hasIsolatedBreaks,
  };
}

type CategoryKey = "cor" | "pi" | "ab" | "cavalo";
type AreaKey = "duzia" | "coluna";

const VOLT_PAIRS: { key: AreaKey; label: string; pairs: [string, string][] }[] = [
  { key: "duzia", label: "DÚZIAS", pairs: [["D1", "D2"], ["D1", "D3"], ["D2", "D3"]] },
  { key: "coluna", label: "COLUNAS", pairs: [["C1", "C2"], ["C1", "C3"], ["C2", "C3"]] },
];

const DELTA_CATEGORIES: { key: CategoryKey; label: string; targetLabel: string }[] = [
  { key: "cor", label: "COR", targetLabel: "COR" },
  { key: "pi", label: "PAR/ÍMPAR", targetLabel: "P/I" },
  { key: "ab", label: "ALTO/BAIXO", targetLabel: "A/B" },
  { key: "cavalo", label: "CAVALO", targetLabel: "CAVALO" },
];

function valueOf(spin: Spin, key: AreaKey | CategoryKey): string {
  return spin.classificacao[key];
}

function countBackward(
  spins: Spin[],
  endIndex: number,
  key: AreaKey | CategoryKey,
  accepted: ReadonlySet<string> | string,
): number {
  let count = 0;
  for (let i = endIndex; i >= 0; i -= 1) {
    const spin = spins[i];
    if (!spin) break;
    const value = valueOf(spin, key);
    const matches = typeof accepted === "string" ? value === accepted : accepted.has(value);
    if (!matches) break;
    count += 1;
  }
  return count;
}

function detectVolt(spins: Spin[], index: number): EntrySignal[] {
  if (index < 6) return [];
  const current = spins[index];
  const breakSpin = spins[index - 1];
  if (!current || !breakSpin) return [];

  const found: EntrySignal[] = [];
  for (const group of VOLT_PAIRS) {
    const currentValue = valueOf(current, group.key);
    const breakValue = valueOf(breakSpin, group.key);
    for (const pair of group.pairs) {
      const accepted = new Set(pair);
      // The latest spin must return to the pair after exactly one excluded spin.
      if (!accepted.has(currentValue) || accepted.has(breakValue)) continue;
      const dominanceEnd = index - 2;
      if (!spins[dominanceEnd] || !accepted.has(valueOf(spins[dominanceEnd]!, group.key))) continue;
      const run = countBackward(spins, dominanceEnd, group.key, accepted);
      if (run < 5) continue;

      const pairText = pair.join(" + ");
      const areaText = group.key === "duzia" ? "DÚZIAS" : "COLUNAS";
      found.push({
        id: `${current.id}:volt-duplo:${group.key}:${pair.join("-")}`,
        strategy: "volt-duplo",
        name: "VOLT Duplo",
        target: `${areaText} ${pairText}`,
        explanation: `Dominância de ${pairText} por ${run} giros, seguida por exatamente 1 giro de quebra (${breakValue}) e retorno para ${currentValue}.`,
        action: `APOSTAR EM ${areaText} ${pair[0]} E ${pair[1]} NO PRÓXIMO GIRO.`,
        sourceSpinId: current.id,
      });
    }
  }
  return found;
}

function detectDelta(spins: Spin[], index: number): EntrySignal[] {
  // Chances simples (COR, P/I e A/B): 5+ dominantes, 1 quebra e retorno.
  // CAVALO mantém a regra anterior de 2 quebras antes do retorno.
  if (index < 6) return [];
  const current = spins[index];
  if (!current) return [];

  const found: EntrySignal[] = [];
  for (const category of DELTA_CATEGORIES) {
    const dominant = valueOf(current, category.key);
    if (dominant === "ZERO" || dominant === "VERDE") continue;

    const breaksRequired = category.key === "cavalo" ? 2 : 1;
    const dominanceEndIndex = index - breaksRequired - 1;
    const dominanceEnd = spins[dominanceEndIndex];
    if (!dominanceEnd || valueOf(dominanceEnd, category.key) !== dominant) continue;

    let validBreak = true;
    const breakValues: string[] = [];
    for (let offset = breaksRequired; offset >= 1; offset -= 1) {
      const breakSpin = spins[index - offset];
      if (!breakSpin || valueOf(breakSpin, category.key) === dominant) {
        validBreak = false;
        break;
      }
      breakValues.push(valueOf(breakSpin, category.key));
    }
    if (!validBreak) continue;

    const run = countBackward(spins, dominanceEndIndex, category.key, dominant);
    if (run < 5) continue;

    const target = `${category.targetLabel}: ${dominant}`;
    found.push({
      id: `${current.id}:delta:${category.key}:${dominant}`,
      strategy: "delta",
      name: "DELTA",
      target,
      explanation: `Dominância de ${dominant} em ${category.label} por ${run} giros, seguida por ${breaksRequired} giro(s) fora da área (${breakValues.join(" e ")}) e retorno à área dominante.`,
      action: `REPETIR ${dominant} EM ${category.targetLabel} NO PRÓXIMO GIRO.`,
      sourceSpinId: current.id,
    });
  }
  return found;
}

/**
 * O ZERO não é tratado como área de tendência. Se cair imediatamente após
 * um sinal VOLT/DELTA, conserva-se o alvo anterior e cria-se uma reentrada
 * para o giro seguinte, desde que o sinal pré-zero esteja confirmado.
 */
export function detectarReentradaAposZero(spins: Spin[], bips: Record<string, TipoBip>): EntrySignal[] {
  const index = spins.length - 1;
  const zeroSpin = spins[index];
  const previousSpin = spins[index - 1];
  if (!zeroSpin || zeroSpin.numero !== 0 || !previousSpin || previousSpin.numero === 0) return [];

  const previousSignals = detectarSinaisEntrada(spins.slice(0, -1), bips);
  const trendSignal = previousSignals.find((signal) =>
    signal.strategy === "volt-duplo" || signal.strategy === "delta"
  );
  if (!trendSignal) return [];

  return [{
    ...trendSignal,
    id: `${zeroSpin.id}:zero-reentry:${trendSignal.id}`,
    sourceSpinId: zeroSpin.id,
    explanation: `ZERO (0) tratado como GREEN/PROTEÇÃO. O sinal ${trendSignal.name} estava confirmado imediatamente antes do zero; a reentrada mantém a direção do alvo anterior: ${trendSignal.target}.`,
    action: `REENTRADA APÓS ZERO: MANTER ${trendSignal.target} NO PRÓXIMO GIRO.`,
  }];
}
function hasThreeWayAlternation(spins: Spin[], key: AreaKey, endIndex: number): boolean {
  if (endIndex < 2) return false;
  const three = spins.slice(endIndex - 2, endIndex + 1).map((spin) => valueOf(spin, key));
  const valid = key === "duzia" ? ["D1", "D2", "D3"] : ["C1", "C2", "C3"];
  return three.every((value) => valid.includes(value)) && new Set(three).size === 3;
}

function detectBrAntecedente(spins: Spin[], bips: Record<string, TipoBip>, index: number): EntrySignal[] {
  const current = spins[index];
  if (!current || index < 3 || bips[current.id] !== "rolando") return [];

  // X-1, X-2 and X-3 are checked; X itself is the spin marked BR.
  const antecedents = spins.slice(index - 3, index);
  const alternating = hasThreeWayAlternation(antecedents, "duzia", 2)
    || hasThreeWayAlternation(antecedents, "coluna", 2);
  if (alternating) return [];

  return [{
    id: `${current.id}:br-antecedente`,
    strategy: "br-antecedente",
    name: "BR Antecedente",
    target: "DÚZIA D2 + COLUNA C2",
    explanation: "BR registrado no giro atual. O filtro analisou os 3 giros anteriores e não encontrou alternância completa de D1/D2/D3 nem de C1/C2/C3.",
    action: "APOSTAR NA DÚZIA D2 E NA COLUNA C2 NO PRÓXIMO GIRO.",
    sourceSpinId: current.id,
  }];
}

function detectBtConcomitante(
  spins: Spin[],
  bips: Record<string, TipoBip>,
  index: number,
  primarySignals: EntrySignal[],
): EntrySignal[] {
  const current = spins[index];
  if (!current || bips[current.id] !== "timer") return [];
  return primarySignals.map((signal) => ({
    ...signal,
    id: `${current.id}:bt-concomitante:${signal.id}`,
    strategy: "bt-concomitante" as const,
    baseStrategy: signal.strategy,
    name: "BT Concomitante",
    explanation: `BT marcado no mesmo giro do sinal ${signal.name}. Padrão-base: ${signal.explanation} A reentrada, se R1 perder o alvo, será avaliada pelo filtro contextual Smart Gale 1.`,
  }));
}

function strategySet(signal: EntrySignal): StrategyId[] {
  return [...new Set([signal.strategy, ...(signal.confluence ?? []), ...(signal.baseStrategy ? [signal.baseStrategy] : [])])];
}

/** Funde todos os gatilhos do mesmo giro em uma única recomendação. Colunas têm prioridade máxima. */
function fuseSignals(candidates: EntrySignal[]): EntrySignal[] {
  if (!candidates.length) return [];
  const columnVolt = candidates.filter((signal) => signal.strategy === "volt-duplo" && signal.target.startsWith("COLUNAS"));
  const dozenVolt = candidates.filter((signal) => signal.strategy === "volt-duplo" && signal.target.startsWith("DÚZIAS"));
  const preferredPool = columnVolt.length ? columnVolt : dozenVolt.length ? dozenVolt : candidates;
  // Em caso de vários pares na mesma matriz, favorece o bloco com maior duração dominante.
  const runLength = (signal: EntrySignal) => Number(signal.explanation.match(/por (\d+) giros/)?.[1] ?? 0);
  const rank = (signal: EntrySignal) => signal.strategy === "volt-duplo" ? 0 : signal.strategy === "br-antecedente" ? 1 : signal.strategy === "delta" ? 2 : 3;
  const chosen = [...preferredPool].sort((a, b) => runLength(b) - runLength(a) || rank(a) - rank(b))[0]!;
  const confluence = [...new Set(candidates.flatMap(strategySet))];
  return [{
    ...chosen,
    confluence,
    explanation: candidates.length > 1
      ? `${chosen.explanation} Gatilhos concomitantes unificados em uma única entrada: ${confluence.map((id) => id.toUpperCase()).join(" + ")}. Prioridade máxima aplicada a COLUNAS quando VOLT detectou dúzias e colunas no mesmo giro.`
      : chosen.explanation,
  }];
}

/**
 * Anexa contexto pós-zero apenas quando o ciclo inteiro de dominância, quebra e retorno
 * ocorreu depois do último zero, dentro da janela máxima de 25 giros.
 */
function annotatePostZero(signals: EntrySignal[], spins: Spin[], index: number): EntrySignal[] {
  const signalIndex = index;
  let zeroIndex = -1;
  for (let i = signalIndex - 1; i >= Math.max(0, signalIndex - 25); i -= 1) {
    if (spins[i]?.numero === 0) { zeroIndex = i; break; }
  }
  if (zeroIndex < 0) return signals;

  return signals.map((signal) => {
    if (signal.strategy !== "volt-duplo" && signal.strategy !== "delta") return signal;
    const run = Number(signal.explanation.match(/por (\d+) giros/)?.[1] ?? 0);
    const isCavalo = signal.strategy === "delta" && signal.target.startsWith("CAVALO:");
    const breaksRequired = isCavalo ? 2 : 1;
    if (!run) return signal;
    // Dominância começa em index - quebras - run; precisa estar inteiramente depois do zero.
    const patternStart = signalIndex - breaksRequired - run;
    if (patternStart <= zeroIndex) return signal;
    return { ...signal, postZeroContext: { zeroSpinId: spins[zeroIndex]!.id, distance: signalIndex - zeroIndex } };
  });
}

/** Detecta e unifica os gatilhos do giro mais recente; nunca emite recomendações duplicadas. */
export function detectarSinaisEntrada(spins: Spin[], bips: Record<string, TipoBip>): EntrySignal[] {
  const index = spins.length - 1;
  if (index < 0) return [];
  // Never allow zero into a pattern window; after a zero, wait three full spins.
  if (isPostZeroQuarantineActive(spins) || isZeroInPatternWindow(spins, 4)) return [];
  // A three-spin repeated column or dozen blocks VOLT/DELTA entry candidates.
  const blockColumnDozenStagnation = hasColumnDozenStagnation(spins);
  const primary = [
    ...(blockColumnDozenStagnation ? [] : [...detectVolt(spins, index), ...detectDelta(spins, index)]),
    ...detectBrAntecedente(spins, bips, index),
  ];
  const fused = fuseSignals(primary);
  // BT é uma confluência do mesmo gatilho, não uma recomendação adicional.
  const result = detectBtConcomitante(spins, bips, index, fused).length
    ? detectBtConcomitante(spins, bips, index, fused)
    : fused;
  const confluence = assessEvenOddConfluence(spins, index);
  const annotated = result.map((signal) => ({ ...signal, ...confluence }));
  return annotatePostZero(annotated, spins, index);
}

/** VOLT Duplo + BR Antecedente concomitantes formam um Super Gatilho mesmo após fusão. */
export function isSuperGatilho(signals: EntrySignal[]): boolean {
  const strategies = new Set(signals.flatMap(strategySet));
  return strategies.has("volt-duplo") && strategies.has("br-antecedente");
}
