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
  baseStrategy?: StrategyId;
  /** Todas as estratégias que confluíram neste único cartão/entrada. */
  confluence?: StrategyId[];
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
  // Minimum: five dominant spins + two break spins + the return spin.
  if (index < 7) return [];
  const current = spins[index];
  if (!current) return [];

  const found: EntrySignal[] = [];
  for (const category of DELTA_CATEGORIES) {
    const dominant = valueOf(current, category.key);
    if (dominant === "ZERO" || dominant === "VERDE") continue;

    const firstBreak = spins[index - 2];
    const secondBreak = spins[index - 1];
    const dominanceEnd = spins[index - 3];
    if (!firstBreak || !secondBreak || !dominanceEnd) continue;
    if (valueOf(firstBreak, category.key) === dominant) continue;
    if (valueOf(secondBreak, category.key) === dominant) continue;
    if (valueOf(dominanceEnd, category.key) !== dominant) continue;

    const run = countBackward(spins, index - 3, category.key, dominant);
    if (run < 5) continue;

    const target = `${category.targetLabel}: ${dominant}`;
    found.push({
      id: `${current.id}:delta:${category.key}:${dominant}`,
      strategy: "delta",
      name: "DELTA",
      target,
      explanation: `Dominância de ${dominant} em ${category.label} por ${run} giros, seguida por 2 giros fora da área (${valueOf(firstBreak, category.key)} e ${valueOf(secondBreak, category.key)}) e retorno à área dominante.`,
      action: `REPETIR ${dominant} EM ${category.targetLabel} NO PRÓXIMO GIRO.`,
      sourceSpinId: current.id,
    });
  }
  return found;
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
    explanation: `BT marcado no mesmo giro do sinal ${signal.name}. A reentrada, se R1 perder o alvo, será avaliada pelo filtro contextual Smart Gale 1.`,
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

/** Detecta e unifica os gatilhos do giro mais recente; nunca emite recomendações duplicadas. */
export function detectarSinaisEntrada(spins: Spin[], bips: Record<string, TipoBip>): EntrySignal[] {
  const index = spins.length - 1;
  if (index < 0) return [];
  const primary = [
    ...detectVolt(spins, index),
    ...detectDelta(spins, index),
    ...detectBrAntecedente(spins, bips, index),
  ];
  const fused = fuseSignals(primary);
  // BT é uma confluência do mesmo gatilho, não uma recomendação adicional.
  return detectBtConcomitante(spins, bips, index, fused).length
    ? detectBtConcomitante(spins, bips, index, fused)
    : fused;
}

/** VOLT Duplo + BR Antecedente concomitantes formam um Super Gatilho mesmo após fusão. */
export function isSuperGatilho(signals: EntrySignal[]): boolean {
  const strategies = new Set(signals.flatMap(strategySet));
  return strategies.has("volt-duplo") && strategies.has("br-antecedente");
}
