import type { Spin } from "./catalogo";
import type { TipoBip } from "./store";

export type StrategyId = "volt-a" | "volt-b" | "delta-a" | "delta-b" | "volt-delta";
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
  blocked?: boolean;
  blockedReason?: string;
  confidencePercent?: number;
  confidenceSampleSize?: number;
  confidenceLevel?: "HIGH" | "LOW" | "INSUFFICIENT";
  tagVisual?: "⭐ RECOMENDADO (MAIOR WR)" | "🛡️ SINAL SECUNDÁRIO / COBERTURA";
  destaque?: boolean;
  priorityOverride?: boolean;
  winRate?: string;
  macroState?: "MONITORING" | "HIGH_SIGNAL" | "BLOCK";
}

export const WINDOW_SIZE = 30;
export const MIN_ACUMULACAO = 5;

type Axis = "duzia" | "coluna";
type DeltaCategoryField = "terminal" | "cavalo" | "high_low" | "even_odd" | "type" | "section" | "color";

interface ValidItem {
  spin: Spin;
  val: string;
}

function filtrarSpinsValidos(spins: Spin[]): Spin[] {
  const lastZeroIndex = spins.map((spin) => spin.numero).lastIndexOf(0);
  const postZeroSpins = lastZeroIndex >= 0 ? spins.slice(lastZeroIndex + 1) : spins;
  return postZeroSpins.slice(-WINDOW_SIZE);
}

function validAxisItems(spins: Spin[], axis: Axis): ValidItem[] {
  return filtrarSpinsValidos(spins)
    .filter((spin) => spin.numero !== 0)
    .map((spin) => ({ spin, val: spin.classificacao[axis] }))
    .filter((item) => Boolean(item.val) && item.val !== "ZERO" && item.val !== "VERDE");
}

function evaluateVolt(spins: Spin[], axis: Axis, variant: "A" | "B"): EntrySignal | null {
  const validItems = validAxisItems(spins, axis);
  const breakCount = variant === "A" ? 1 : 2;
  const requiredLen = MIN_ACUMULACAO + breakCount + 1;
  if (validItems.length < requiredLen) return null;

  const lastItem = validItems[validItems.length - 1]!;
  const breakItems = validItems.slice(-(breakCount + 1), -1);
  const preBreakItems = validItems.slice(0, -(breakCount + 1));
  const accumulation: ValidItem[] = [];
  const unique = new Set<string>();
  for (let i = preBreakItems.length - 1; i >= 0; i--) {
    const item = preBreakItems[i]!;
    if (!unique.has(item.val) && unique.size === 2) break;
    unique.add(item.val);
    accumulation.unshift(item);
  }
  if (accumulation.length < MIN_ACUMULACAO || unique.size !== 2) return null;
  const [area1, area2] = Array.from(unique);
  const hasExpectedBreaks = breakItems.every((item) => item.val !== area1 && item.val !== area2);
  const returnedToAccumulation = lastItem.val === area1 || lastItem.val === area2;
  if (!hasExpectedBreaks || !returnedToAccumulation) return null;

  const label = axis === "duzia" ? "DÚZIAS" : "COLUNAS";
  const target = `${label} ${area1} + ${area2}`;
  const breakDescription = breakItems.map((item) => item.val).join(" → ");
  return {
    id: `volt-${variant.toLowerCase()}:${axis}:${lastItem.spin.id}`,
    strategy: variant === "A" ? "volt-a" : "volt-b",
    name: `⚡ VOLT ${variant}`,
    target,
    explanation: `Acumulação de ${accumulation.length} giros nas duas áreas [${area1}, ${area2}], ${breakCount} quebra(s) em ${breakDescription} e retorno em ${lastItem.val}.`,
    action: `Entrada imediata para o próximo giro: ${target}.`,
    sourceSpinId: lastItem.spin.id,
    phase: "R1",
  };
}

function deltaValue(spin: Spin, field: DeltaCategoryField): string {
  const c = spin.classificacao;
  switch (field) {
    case "color": return c.cor;
    case "terminal": return c.terminal;
    case "cavalo": return c.cavalo;
    case "high_low": return c.ab;
    case "even_odd": return c.pi;
    case "type": return c.tipo;
    case "section": return c.secao;
  }
}

function deltaLabel(field: DeltaCategoryField): string {
  switch (field) {
    case "color": return "COR";
    case "terminal": return "TERMINAL";
    case "cavalo": return "CAVALO";
    case "high_low": return "ALTO/BAIXO";
    case "even_odd": return "PAR/ÍMPAR";
    case "type": return "TIPO";
    case "section": return "SEÇÃO";
  }
}

function evaluateDelta(spins: Spin[], field: DeltaCategoryField, variant: "A" | "B"): EntrySignal | null {
  const validItems = filtrarSpinsValidos(spins)
    .filter((spin) => spin.numero !== 0)
    .map((spin) => ({ spin, val: deltaValue(spin, field) }))
    .filter((item) => Boolean(item.val) && !["ZERO", "VERDE", "Zero"].includes(item.val));

  const breakCount = variant === "A" ? 1 : 2;
  const requiredLen = MIN_ACUMULACAO + breakCount + 1;
  if (validItems.length < requiredLen) return null;

  const lastItem = validItems[validItems.length - 1]!;
  const breakItems = validItems.slice(-(breakCount + 1), -1);
  const preBreakItems = validItems.slice(0, -(breakCount + 1));
  const targetCategory = preBreakItems[preBreakItems.length - 1]?.val;
  if (!targetCategory) return null;
  const volatileFields: DeltaCategoryField[] = ["color", "cavalo", "terminal", "section"];
  if (volatileFields.includes(field)) {
    const deepWindow = preBreakItems.slice(-10);
    if (deepWindow.length < 10 || deepWindow.filter((item) => item.val === targetCategory).length < 5) return null;
  }
  const accumulation: ValidItem[] = [];
  for (let i = preBreakItems.length - 1; i >= 0; i--) {
    if (preBreakItems[i]!.val !== targetCategory) break;
    accumulation.unshift(preBreakItems[i]!);
  }
  if (accumulation.length < MIN_ACUMULACAO) return null;
  if (!breakItems.every((item) => item.val !== targetCategory) || lastItem.val !== targetCategory) return null;

  const target = `${deltaLabel(field)}: ${targetCategory}`;
  const breakDescription = breakItems.map((item) => item.val).join(" → ");
  return {
    id: `delta-${variant.toLowerCase()}:${field}:${lastItem.spin.id}`,
    strategy: variant === "A" ? "delta-a" : "delta-b",
    name: `Δ DELTA ${variant}`,
    target,
    explanation: `Acumulação exata de ${accumulation.length} giros em ${targetCategory}, ${breakCount} quebra(s) (${breakDescription}) e retorno em ${targetCategory}.`,
    action: `Entrada imediata para o próximo giro: ${target}.`,
    sourceSpinId: lastItem.spin.id,
    phase: "R1",
  };
}

export function detectarSinaisEntrada(spins: Spin[], _bips: Record<string, TipoBip>): EntrySignal[] {
  if (!spins.length || spins[spins.length - 1]?.numero === 0) return [];
  const voltCandidates = [
    evaluateVolt(spins, "duzia", "A"),
    evaluateVolt(spins, "coluna", "A"),
    evaluateVolt(spins, "duzia", "B"),
    evaluateVolt(spins, "coluna", "B"),
  ].filter((signal): signal is EntrySignal => signal !== null);
  const deltaFields: DeltaCategoryField[] = ["color", "terminal", "cavalo", "high_low", "even_odd", "type", "section"];
  const deltaCandidates = deltaFields.flatMap((field) => [
    evaluateDelta(spins, field, "A"),
    evaluateDelta(spins, field, "B"),
  ]).filter((signal): signal is EntrySignal => signal !== null);

  if (voltCandidates.length && deltaCandidates.length) {
    const volt = voltCandidates[0]!;
    const delta = deltaCandidates[0]!;
    return [{
      id: `volt-delta:${volt.sourceSpinId}:${volt.id}:${delta.id}`,
      strategy: "volt-delta",
      name: "⚡ VOLT + Δ DELTA",
      target: volt.target,
      deltaTarget: delta.target,
      explanation: `Confluência no mesmo giro. VOLT: ${volt.explanation} DELTA: ${delta.explanation}`,
      action: `Entrada imediata para o próximo giro: ${volt.target} + ${delta.target}.`,
      sourceSpinId: volt.sourceSpinId,
      phase: "R1",
    }];
  }
  return [...voltCandidates, ...deltaCandidates];
}

export function detectarReentradaAposZero(spins: Spin[], bips: Record<string, TipoBip>): EntrySignal[] {
  return detectarSinaisEntrada(spins, bips);
}

export function isSuperGatilho(signals: EntrySignal[]): boolean {
  return signals.some((signal) => signal.strategy === "volt-delta");
}
