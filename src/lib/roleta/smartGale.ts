import type { Spin } from "./catalogo";
import type { TipoBip } from "./store";
import { detectarSinaisEntrada, type EntrySignal, type StrategyId } from "./signalEngine";

export type SmartGaleStatus = "APPROVED" | "BLOCKED";
export interface SmartGaleDecision {
  id: string;
  signalId: string;
  strategy: StrategyId;
  status: SmartGaleStatus;
  r1Number: number;
  title: string;
  reason: string;
  /** A arquitetura só admite Gale 1; Gale 2 não possui tipo nem caminho de execução. */
  galeLevel: 1;
}

function mode(values: string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value || value === "ZERO" || value === "VERDE" || value === "Zero") continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function targetValues(signal: EntrySignal, prefix: string): string[] {
  const rest = signal.target.slice(prefix.length).trim();
  return rest.split("+").map((part) => part.trim().toUpperCase()).filter(Boolean);
}

function hitSignal(signal: EntrySignal, spin: Spin): boolean {
  const strategy = signal.strategy === "bt-concomitante" ? signal.baseStrategy : signal.strategy;
  if (strategy === "volt-duplo") {
    if (signal.target.startsWith("DÚZIAS")) return targetValues(signal, "DÚZIAS").includes(spin.classificacao.duzia);
    if (signal.target.startsWith("COLUNAS")) return targetValues(signal, "COLUNAS").includes(spin.classificacao.coluna);
  }
  if (strategy === "br-antecedente") {
    return spin.classificacao.duzia === "D2" || spin.classificacao.coluna === "C2";
  }
  if (strategy === "delta") {
    const separator = signal.target.indexOf(":");
    if (separator < 0) return false;
    const category = signal.target.slice(0, separator).trim();
    const value = signal.target.slice(separator + 1).trim();
    if (!category || !value) return false;
    const key = category === "COR" ? "cor" : category === "P/I" ? "pi" : category === "A/B" ? "ab" : "cavalo";
    return spin.classificacao[key] === value;
  }
  return false;
}

function voltDecision(signal: EntrySignal, history: Spin[], r1: Spin): { status: SmartGaleStatus; reason: string } {
  const sourceIndex = history.findIndex((spin) => spin.id === signal.sourceSpinId);
  const areaKey = signal.target.startsWith("DÚZIAS") ? "duzia" : "coluna";
  const target = targetValues(signal, areaKey === "duzia" ? "DÚZIAS" : "COLUNAS");
  const inTarget = target.includes(r1.classificacao[areaKey]);
  if (inTarget) return { status: "BLOCKED", reason: "R1 atingiu uma das áreas cobertas; o resultado não é uma perda integral do VOLT Duplo." };

  const dominance = sourceIndex >= 6 ? history.slice(sourceIndex - 6, sourceIndex - 1) : [];
  const dominantSecao = mode(dominance.map((spin) => spin.classificacao.secao));
  const dominantAxis = mode(dominance.map((spin) => spin.classificacao.g010));
  const secaoAligned = Boolean(dominantSecao && r1.classificacao.secao === dominantSecao);
  const axisAligned = Boolean(dominantAxis && r1.classificacao.g010 === dominantAxis);
  if (secaoAligned || axisAligned) {
    return { status: "APPROVED", reason: `R1 saiu do bloco VOLT, mas o contexto de cilindro segue alinhado (${secaoAligned ? "SEÇÃO" : "0/10"}). Autoriza somente Gale 1.` };
  }
  return { status: "BLOCKED", reason: "R1 saiu do bloco VOLT e rompeu simultaneamente a SEÇÃO e o eixo 0/10 dominantes. Aguarde novo sinal." };
}

function brDecision(signal: EntrySignal, history: Spin[], r1: Spin): { status: SmartGaleStatus; reason: string } {
  const sourceIndex = history.findIndex((spin) => spin.id === signal.sourceSpinId);
  const source = history[sourceIndex];
  const missesBoth = r1.classificacao.duzia !== "D2" && r1.classificacao.coluna !== "C2";
  if (!missesBoth) return { status: "BLOCKED", reason: "R1 atingiu D2 ou C2; não há perda integral que justifique reentrada." };
  if (!source || sourceIndex < 3) return { status: "BLOCKED", reason: "Histórico insuficiente para confirmar o contexto BR." };

  const context = history.slice(sourceIndex - 3, sourceIndex);
  const dominantAb = mode(context.map((spin) => spin.classificacao.ab));
  const dominantCor = mode(context.map((spin) => spin.classificacao.cor));
  const dominantDuzia = mode(context.map((spin) => spin.classificacao.duzia));
  const dominantColuna = mode(context.map((spin) => spin.classificacao.coluna));
  const dominantSecao = mode(context.map((spin) => spin.classificacao.secao));
  const dominantAxis = mode(context.map((spin) => spin.classificacao.g010));
  const breaksHeight = Boolean(dominantAb && r1.classificacao.ab !== dominantAb);
  const breaksDozen = Boolean(dominantDuzia && r1.classificacao.duzia !== dominantDuzia);
  const breaksColumn = Boolean(dominantColuna && r1.classificacao.coluna !== dominantColuna);
  if (breaksHeight && breaksDozen && breaksColumn) {
    return { status: "BLOCKED", reason: "R1 rompeu simultaneamente ALTURA, DÚZIA e COLUNA (3× quebra). Proteção de banca: aguarde novo sinal." };
  }
  const sectionAligned = Boolean(dominantSecao && r1.classificacao.secao === dominantSecao);
  const axisAligned = Boolean(dominantAxis && r1.classificacao.g010 === dominantAxis);
  if (!sectionAligned && !axisAligned) {
    return { status: "BLOCKED", reason: "BR perdeu D2/C2 e R1 rompeu simultaneamente a SEÇÃO e o eixo 0/10 do cilindro. Gale 1 bloqueado; aguarde novo sinal." };
  }
  const retainsHeight = Boolean(dominantAb && r1.classificacao.ab === dominantAb);
  const retainsColor = Boolean(dominantCor && r1.classificacao.cor === dominantCor);
  if (retainsHeight || retainsColor) {
    return { status: "APPROVED", reason: `R1 perdeu D2/C2, preservou ${retainsHeight ? "a altura dominante" : "a cor dominante"} e manteve inércia do cilindro (${sectionAligned ? "SEÇÃO" : "eixo 0/10"}). Autoriza somente Gale 1.` };
  }
  return { status: "BLOCKED", reason: "R1 perdeu D2/C2 e não preservou altura nem cor dominantes. Aguarde novo sinal." };
}

function btDecision(signal: EntrySignal, history: Spin[], r1: Spin): { status: SmartGaleStatus; reason: string } {
  const nearBorder = [17, 18, 19, 20].includes(r1.numero);
  const previous = history[history.length - 1];
  const deepOppositeEdge = (r1.numero <= 14 || r1.numero >= 23)
    && previous?.classificacao.cavalo === r1.classificacao.cavalo;
  if (deepOppositeEdge) return { status: "BLOCKED", reason: "R1 caiu profundamente na borda oposta com repetição de CAVALO. Gale 1 bloqueado." };
  if (nearBorder) return { status: "APPROVED", reason: "R1 caiu na zona de fronteira 17/18 ou 19/20. Contexto limítrofe permite somente Gale 1." };
  return { status: "BLOCKED", reason: "R1 não caiu na zona de fronteira definida para BT Concomitante. Gale 1 bloqueado." };
}

/**
 * Reavalia apenas a rodada imediatamente posterior ao sinal anterior (R1).
 * Não cria apostas, não executa Gale 2 e não persiste nem aumenta valores de stake.
 */
export function avaliarSmartGale1(spins: Spin[], bips: Record<string, TipoBip>): SmartGaleDecision | null {
  if (spins.length < 2) return null;
  const r1 = spins[spins.length - 1]!;
  const history = spins.slice(0, -1);
  const sinaisAnteriores = detectarSinaisEntrada(history, bips);
  if (!sinaisAnteriores.length) return null;

  // A análise só vale para sinais emitidos no giro imediatamente anterior ao R1.
  const candidatos = sinaisAnteriores
    .filter((signal) => signal.sourceSpinId === history[history.length - 1]?.id)
    .sort((a, b) => Number(b.strategy === "bt-concomitante") - Number(a.strategy === "bt-concomitante"));
  const signal = candidatos.find((candidate) => !hitSignal(candidate, r1));
  if (!signal) return null;

  let result: { status: SmartGaleStatus; reason: string };
  const primaryStrategy = signal.strategy === "bt-concomitante" ? signal.baseStrategy : signal.strategy;
  if (primaryStrategy === "volt-duplo") {
    result = voltDecision(signal, history, r1);
  } else if (primaryStrategy === "br-antecedente") {
    result = brDecision(signal, history, r1);
  } else if (primaryStrategy === "delta") {
    const hasBrConfluence = candidatos.some((candidate) => candidate.strategy === "br-antecedente");
    result = hasBrConfluence
      ? { status: "APPROVED", reason: "DELTA teve confluência com BR Antecedente no mesmo gatilho; contexto autoriza somente Gale 1." }
      : { status: "BLOCKED", reason: "DELTA não oferece Gale por padrão. Sem confluência BR simultânea, a reentrada é bloqueada." };
  } else {
    result = btDecision(signal, history, r1);
  }

  return {
    id: `${signal.id}:smart-gale-1:${r1.id}:${result.status}`,
    signalId: signal.id,
    strategy: primaryStrategy ?? signal.strategy,
    status: result.status,
    r1Number: r1.numero,
    title: result.status === "APPROVED"
      ? "⚠️ REENTRADA AUTORIZADA: GALE 1 CONFIRMADO (Contexto Favorável Mantido)"
      : "🛑 GALE 1 REJEITADO: Proteção de Banca Ativada (Mudança de Tendência Detectada - AGUARDE NOVO SINAL)",
    reason: result.reason,
    galeLevel: 1,
  };
}
