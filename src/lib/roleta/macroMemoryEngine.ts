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

const BUFFER_SIZE = 100;
const MIN_SPINS_BEFORE_SIGNAL = 15;
const SAMPLE_SIZE = 5;
type Sector = "High_Low" | "Dozen" | "Column" | "Even_Odd" | "Color";

function sectorValue(spin: Spin, sector: Sector): string {
  const c = spin.classificacao;
  switch (sector) {
    case "High_Low": return c.ab;
    case "Dozen": return c.duzia;
    case "Column": return c.coluna;
    case "Even_Odd": return c.pi;
    case "Color": return c.cor;
  }
}

/** Avalia somente a mesa ativa: o Zero encerra a amostra e nunca é atravessado. */
function recentValidBuffer(spins: Spin[]): Spin[] {
  const buffer = spins.slice(-BUFFER_SIZE);
  const lastZero = buffer.map((spin) => spin.numero).lastIndexOf(0);
  return (lastZero >= 0 ? buffer.slice(lastZero + 1) : buffer);
}

function isAlternating(values: string[]): boolean {
  if (values.length < 4) return false;
  for (let k = 2; k < values.length; k++) {
    if (values[k] !== values[k - 2]) return false;
  }
  return true;
}

function createSignal(
  source: Spin,
  strategy: EntrySignal["strategy"],
  name: string,
  target: string,
  explanation: string,
  action: string,
  deltaTarget?: string,
): EntrySignal {
  return {
    id: `${strategy}:${source.id}:${target}:${deltaTarget ?? ""}`,
    strategy,
    name,
    target,
    ...(deltaTarget ? { deltaTarget } : {}),
    explanation,
    action,
    sourceSpinId: source.id,
    phase: "R1",
  };
}

/**
 * MacroMemoryEngine: buffer deslizante de 100 giros, amostra de decisão de 5.
 * A regra é determinística e não utiliza win-rate ou resultados de sessões passadas.
 */
export class MacroMemoryEngine {
  private historyBuffer: Spin[] = [];
  readonly minSpinsBeforeSignal = MIN_SPINS_BEFORE_SIGNAL;

  ingestSpin(spinData: Spin): void {
    this.historyBuffer.push(spinData);
    if (this.historyBuffer.length > BUFFER_SIZE) this.historyBuffer.shift();
  }

  evaluateMacroState(totalSpinCount = this.historyBuffer.length): MacroMemoryAssessment {
    const activeHistory = recentValidBuffer(this.historyBuffer);
    const window5 = activeHistory.slice(-SAMPLE_SIZE);
    const empty = (
      status: MacroMemoryStatus,
      message: string,
      altCount = 0,
      streakCount = 0,
      signals: EntrySignal[] = [],
    ): MacroMemoryAssessment => ({
      status, message, spinCount: totalSpinCount, windowSize: activeHistory.length,
      altCount, streakCount, signals,
    });

    if (totalSpinCount < this.minSpinsBeforeSignal) {
      return empty("MONITORING", `MONITORING • fase de mapeamento inicial (${totalSpinCount}/${this.minSpinsBeforeSignal} giros). Sinais suprimidos.`);
    }
    if (window5.length < SAMPLE_SIZE) {
      return empty("MONITORING", "MONITORING • aguardando cinco giros válidos após o último Zero.");
    }

    const sectors: Sector[] = ["High_Low", "Dozen", "Column", "Even_Odd", "Color"];
    const activeStreaks: Array<{ sector: Sector; value: string }> = [];
    let altCount = 0;

    for (const sector of sectors) {
      const vals = window5.map((spin) => sectorValue(spin, sector));
      if (new Set(vals).size === 1 && vals[0] !== "ZERO" && vals[0] !== "VERDE" && vals[0] !== "Zero") {
        activeStreaks.push({ sector, value: vals[0]! });
      } else if (isAlternating(vals)) {
        altCount++;
      }
    }

    const streakCount = activeStreaks.length;
    if (altCount >= 2) {
      return empty("BLOCK", "BLOCK CAIXA • alta alternância síncrona detectada em dois ou mais setores. Caixa blindada.", altCount, streakCount);
    }

    const source = window5.at(-1)!;
    if (streakCount >= 2) {
      const labels: Record<Sector, string> = {
        High_Low: "ALTO/BAIXO", Dozen: "DÚZIAS", Column: "COLUNAS",
        Even_Odd: "PAR/ÍMPAR", Color: "COR",
      };
      const chosen = activeStreaks.slice(0, 2);
      const targets = chosen.map(({ sector, value }) => `${labels[sector]}: ${value}`);
      const signal = createSignal(
        source, "volt-delta", "VOLT CONFLUENCE", targets[0]!,
        `Confluência multi-setor detectada em ${streakCount} áreas, com repetição idêntica nos últimos cinco giros.`,
        `HIGH SIGNAL • confluência multi-setor: ${targets.join(" + ")}.`,
        targets[1],
      );
      return empty("HIGH_SIGNAL", `HIGH SIGNAL • confluência multi-setor detectada em ${streakCount} áreas.`, altCount, streakCount, [signal]);
    }

    if (streakCount === 1 && (activeStreaks[0]!.sector === "Color" || activeStreaks[0]!.sector === "High_Low")) {
      const isolated = activeStreaks[0]!;
      const label = isolated.sector === "Color" ? "COR" : "ALTO/BAIXO";
      const target = `${label}: ${isolated.value}`;
      const signal = createSignal(
        source, "atlas-exhaustion", "ATLAS EXHAUSTION", target,
        `Exaustão isolada detetada em ${isolated.sector} após cinco giros consecutivos na mesma categoria.`,
        `ATLAS TRIGGER • eixo binário identificado: ${target}.`,
      );
      return empty("ATLAS_TRIGGER", `ATLAS TRIGGER • exaustão isolada em ${isolated.sector}.`, altCount, streakCount, [signal]);
    }

    return empty("MONITORING", "MONITORING • fluxo neutro; aguardando gatilho estrutural.", altCount, streakCount);
  }
}

/** Adaptador puro para o hook React; mantém o motor sincronizado com a mesa atual. */
export function evaluateMacroMemory(spins: Spin[]): MacroMemoryAssessment {
  const engine = new MacroMemoryEngine();
  for (const spin of spins.slice(-BUFFER_SIZE)) engine.ingestSpin(spin);
  return engine.evaluateMacroState(spins.length);
}
