import type { Spin } from "./catalogo";
import type { EntrySignal } from "./signalEngine";

export type MacroMemoryStatus = "MONITORING" | "ATLAS_TRIGGER" | "HIGH_SIGNAL" | "BLOCK";
export interface MacroMemoryAssessment {
  status: MacroMemoryStatus;
  message: string;
  spinCount: number;
  windowSize: number;
  altCount: number;
  streakCount: number;
  signals: EntrySignal[];
}

const WINDOW_SIZE = 30;
const OPENING_LOCK = 15;
const ALT_THRESHOLD = 65;
const MIN_STREAK = 5;
type Sector = "color" | "high_low" | "dozen" | "column" | "section" | "terminal";

function valueOf(spin: Spin, sector: Sector): string {
  const c = spin.classificacao;
  switch (sector) {
    case "color": return c.cor;
    case "high_low": return c.ab;
    case "dozen": return c.duzia;
    case "column": return c.coluna;
    case "section": return c.secao;
    case "terminal": return c.terminal;
  }
}
function validHistory(spins: Spin[]): Spin[] {
  const lastZero = spins.map((spin) => spin.numero).lastIndexOf(0);
  return (lastZero >= 0 ? spins.slice(lastZero + 1) : spins).slice(-WINDOW_SIZE);
}
function alternation(values: string[]): number {
  const usable = values.filter((value) => value && value !== "ZERO" && value !== "VERDE" && value !== "Zero");
  if (usable.length < 6) return 0;
  let changes = 0;
  for (let i = 1; i < usable.length; i++) if (usable[i] !== usable[i - 1]) changes++;
  return changes / (usable.length - 1) * 100;
}
function trailingStreak(values: string[]): { value: string; count: number } {
  const value = values.at(-1) ?? "";
  if (!value || value === "ZERO" || value === "VERDE" || value === "Zero") return { value: "", count: 0 };
  let count = 0;
  for (let i = values.length - 1; i >= 0 && values[i] === value; i--) count++;
  return { value, count };
}
function atlasSignal(history: Spin[], sector: "color" | "high_low"): EntrySignal | null {
  const values = history.map((spin) => valueOf(spin, sector));
  const usable = values.filter((value) => value && value !== "ZERO" && value !== "VERDE" && value !== "Zero");
  if (usable.length < MIN_STREAK + 2) return null;
  const sample = usable.slice(-(MIN_STREAK + 2));
  const base = sample[0]!;
  const accumulation = sample.slice(0, MIN_STREAK);
  const breaks = sample.slice(MIN_STREAK, MIN_STREAK + 1);
  const returned = sample.at(-1)!;
  if (!accumulation.every((value) => value === base) || breaks[0] === base || returned !== base) return null;
  const spin = history.at(-1)!;
  const label = sector === "color" ? "COR" : "ALTO/BAIXO";
  const target = `${label}: ${base}`;
  return {
    id: `atlas:${sector}:${spin.id}`, strategy: "delta-a", name: "ATLAS TRIGGER",
    target, explanation: "Exaustão isolada em eixo binário após acumulação, quebra e retorno.",
    action: `ATLAS TRIGGER identificado em ${target}. Estado informativo; valide o risco antes de qualquer decisão.`,
    sourceSpinId: spin.id, phase: "R1",
  };
}

/** Motor macro sem dependência de win-rate ou resultados de sessões anteriores. */
export function evaluateMacroMemory(spins: Spin[]): MacroMemoryAssessment {
  const history = validHistory(spins);
  const empty = (status: MacroMemoryStatus, message: string, altCount = 0, streakCount = 0, signals: EntrySignal[] = []): MacroMemoryAssessment => ({
    status, message, spinCount: spins.length, windowSize: history.length, altCount, streakCount, signals,
  });
  if (spins.length < OPENING_LOCK) return empty("MONITORING", `MONITORING • calibração inicial: ${spins.length}/${OPENING_LOCK} giros. Nenhum alerta ou sinal será disparado.`);
  if (!history.length || spins.at(-1)?.numero === 0) return empty("MONITORING", "MONITORING • aguardando novos giros válidos após o Zero.");

  const sectors: Sector[] = ["color", "high_low", "dozen", "column", "section", "terminal"];
  const altCount = sectors.filter((sector) => alternation(history.map((spin) => valueOf(spin, sector))) > ALT_THRESHOLD).length;
  if (altCount >= 2) return empty("BLOCK", `BLOCK CAIXA • zigue-zague síncrono detectado em ${altCount} setores. Todos os sinais foram suprimidos.`, altCount);

  const structuralSectors: Sector[] = ["dozen", "column", "section", "terminal"];
  const streaks = structuralSectors.map((sector) => {
    const streak = trailingStreak(history.map((spin) => valueOf(spin, sector)));
    return { sector, ...streak };
  }).filter((item) => item.count >= MIN_STREAK);
  const uniqueSectors = new Map(streaks.map((item) => [item.sector, item]));
  const streakCount = uniqueSectors.size;
  if (streakCount >= 2) {
    const chosen = Array.from(uniqueSectors.values()).sort((a, b) => b.count - a.count).slice(0, 2);
    const label: Record<Sector, string> = { dozen: "DÚZIAS", column: "COLUNAS", section: "SEÇÃO", terminal: "TERMINAL", color: "COR", high_low: "ALTO/BAIXO" };
    const targets = chosen.map((item) => `${label[item.sector]}: ${item.value}`);
    const source = history.at(-1)!;
    const signal: EntrySignal = {
      id: `volt-confluence:${source.id}:${chosen.map((item) => item.sector).join("-")}`,
      strategy: "volt-delta", name: "VOLT CONFLUENCE",
      target: targets[0]!, deltaTarget: targets[1]!,
      explanation: `Confluência multi-setor: ${streakCount} setores com sequência mínima de ${MIN_STREAK} giros.`,
      action: `HIGH SIGNAL • confluência multi-setor: ${targets.join(" + ")}.`,
      sourceSpinId: source.id, phase: "R1",
    };
    return empty("HIGH_SIGNAL", "HIGH SIGNAL • confluência multi-setor confirmada.", altCount, streakCount, [signal]);
  }

  const atlas = (["color", "high_low"] as const).map((sector) => atlasSignal(history, sector)).filter((signal): signal is EntrySignal => signal !== null);
  if (atlas.length) return empty("ATLAS_TRIGGER", "ATLAS TRIGGER • exaustão isolada detectada em eixo binário.", altCount, streakCount, atlas);
  return empty("MONITORING", "MONITORING • fluxo neutro; memória macro mapeando a mesa.", altCount, streakCount);
}
