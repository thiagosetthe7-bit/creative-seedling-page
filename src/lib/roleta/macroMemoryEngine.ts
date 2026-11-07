import type { Spin } from "./catalogo";
import type { EntrySignal } from "./signalEngine";

export type MacroMemoryStatus = "MONITORING" | "HIGH_SIGNAL" | "BLOCK";
export interface MacroMemoryAssessment {
  status: MacroMemoryStatus;
  message: string;
  descricao: string;
  estrategia?: "CONFLUÊNCIA VOLT" | "ZIGUE-ZAGUE CAÓTICO";
  confianca?: "MÁXIMA";
  alvoPrincipal?: { setor: string; valor: string };
  setorConfluencia?: { setor: string; valor: string };
  spinCount: number;
  windowSize: number;
  altCount: number;
  streakCount: number;
  signals: EntrySignal[];
}

const BUFFER_SIZE = 100;
const MIN_SPINS_BEFORE_SIGNAL = 20;
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

/** O Zero é uma fronteira absoluta: padrões anteriores não atravessam o Zero. */
function recentValidBuffer(spins: Spin[]): Spin[] {
  const buffer = spins.slice(-BUFFER_SIZE);
  const lastZero = buffer.map((spin) => spin.numero).lastIndexOf(0);
  return lastZero >= 0 ? buffer.slice(lastZero + 1) : buffer;
}

function isAlternating(values: string[]): boolean {
  if (values.length < 4) return false;
  for (let k = 2; k < values.length; k++) {
    if (values[k] !== values[k - 2]) return false;
  }
  return true;
}

function createSignal(source: Spin, targetA: string, targetB: string, streakCount: number): EntrySignal {
  return {
    id: `volt-confluence:${source.id}:${targetA}:${targetB}`,
    strategy: "volt-delta",
    name: "CONFLUÊNCIA VOLT",
    target: targetA,
    deltaTarget: targetB,
    explanation: `Confluência multi-setor detetada em ${streakCount} áreas, com repetição idêntica nos últimos cinco giros.`,
    action: `Entrada firme: ${targetA} + ${targetB}.`,
    sourceSpinId: source.id,
    phase: "R1",
    macroState: "HIGH_SIGNAL",
  };
}

/**
 * Memória macro da mesa ativa. Não usa ATLAS, win-rate de sessão ou estatísticas micro.
 * Mantém no máximo 100 giros e exige 20 giros catalogados antes de avaliar sinais.
 */
export class MacroMemoryEngine {
  private historyBuffer: Spin[] = [];
  readonly minSpinsBeforeSignal = MIN_SPINS_BEFORE_SIGNAL;

  ingestSpin(spinData: Spin): void {
    this.historyBuffer.push(spinData);
    if (this.historyBuffer.length > BUFFER_SIZE) this.historyBuffer.shift();
  }

  avaliarEstadoMacro(totalGiros = this.historyBuffer.length): MacroMemoryAssessment {
    const historicoAtivo = recentValidBuffer(this.historyBuffer);
    const janela5 = historicoAtivo.slice(-SAMPLE_SIZE);
    const empty = (
      status: MacroMemoryStatus,
      message: string,
      descricao: string,
      altCount = 0,
      streakCount = 0,
      signals: EntrySignal[] = [],
    ): MacroMemoryAssessment => ({
      status, message, descricao, spinCount: totalGiros,
      windowSize: historicoAtivo.length, altCount, streakCount, signals,
    });

    if (totalGiros <= this.minSpinsBeforeSignal) {
      return empty(
        "MONITORING",
        "PRÉ-CATALOGAÇÃO • 20 giros concluídos antes de liberar a análise.",
        `Pré-catalogação de 20 números em andamento (${Math.min(totalGiros, 20)}/20). Sinais suprimidos.`,
      );
    }

    if (janela5.length < SAMPLE_SIZE) {
      return empty(
        "MONITORING",
        "MONITORAMENTO • aguardando cinco giros válidos após o último Zero.",
        "Amostra estrutural insuficiente após o Zero. Nenhum sinal será emitido.",
      );
    }

    const setores: Sector[] = ["High_Low", "Dozen", "Column", "Even_Odd", "Color"];
    const setoresAtivos: Array<{ sector: Sector; value: string }> = [];
    let contagemAlt = 0;

    for (const setor of setores) {
      const valores = janela5.map((spin) => sectorValue(spin, setor));
      const validos = valores.every((value) => Boolean(value) && !["ZERO", "VERDE", "Zero"].includes(value));
      if (!validos) continue;

      if (new Set(valores).size === 1) {
        setoresAtivos.push({ sector: setor, value: valores[0]! });
      } else if (isAlternating(valores)) {
        contagemAlt++;
      }
    }

    const contagemStreaks = setoresAtivos.length;
    if (contagemAlt >= 2) {
      return empty(
        "BLOCK",
        "BLOQUEIO DE CAIXA • zigue-zague caótico detectado.",
        "Mesa em alta alternância síncrona em dois ou mais setores. Caixa blindada contra perdas.",
        contagemAlt,
        contagemStreaks,
      );
    }

    if (contagemStreaks >= 2) {
      const principal = setoresAtivos[0]!;
      const confluencia = setoresAtivos[1]!;
      const labels: Record<Sector, string> = {
        High_Low: "ALTO/BAIXO",
        Dozen: "DÚZIAS",
        Column: "COLUNAS",
        Even_Odd: "PAR/ÍMPAR",
        Color: "COR",
      };
      const alvoPrincipal = { setor: principal.sector, valor: principal.value };
      const setorConfluencia = { setor: confluencia.sector, valor: confluencia.value };
      const targetA = `${labels[principal.sector]}: ${principal.value}`;
      const targetB = `${labels[confluencia.sector]}: ${confluencia.value}`;
      const signal = createSignal(janela5[janela5.length - 1]!, targetA, targetB, contagemStreaks);
      return {
        status: "HIGH_SIGNAL",
        message: `SINAL DE ALTA FIRMEZA • confluência detectada em ${contagemStreaks} setores.`,
        descricao: `Confluência multi-setor detetada em ${contagemStreaks} áreas. Entrada firme autorizada.`,
        estrategia: "CONFLUÊNCIA VOLT",
        confianca: "MÁXIMA",
        alvoPrincipal,
        setorConfluencia,
        spinCount: totalGiros,
        windowSize: historicoAtivo.length,
        altCount: contagemAlt,
        streakCount: contagemStreaks,
        signals: [signal],
      };
    }

    return empty(
      "MONITORING",
      "MONITORAMENTO • fluxo neutro.",
      "Mesa em fluxo estável. Aguardando padrão estrutural de confluência.",
      contagemAlt,
      contagemStreaks,
    );
  }

  /** Alias de compatibilidade usado pelo hook atual. */
  evaluateMacroState(totalSpinCount = this.historyBuffer.length): MacroMemoryAssessment {
    return this.avaliarEstadoMacro(totalSpinCount);
  }
}

/** Adaptador puro para o hook React; cada avaliação considera a mesa ativa. */
export function evaluateMacroMemory(spins: Spin[]): MacroMemoryAssessment {
  const engine = new MacroMemoryEngine();
  for (const spin of spins.slice(-BUFFER_SIZE)) engine.ingestSpin(spin);
  return engine.avaliarEstadoMacro(spins.length);
}
