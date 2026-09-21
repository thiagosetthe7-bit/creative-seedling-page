/**
 * BIP ANALYZER — motor determinístico de sinais visuais.
 *
 * Referência temporal:
 * - Rodada anterior = número imediatamente anterior ao BIP atual.
 * - BIP atual = marcação BT (timer) ou BR (rolando) da rodada atual.
 * - Próximo giro = rodada seguinte ao BIP atual, quando já catalogada.
 *
 * A estratégia oficial é analisada por analisarBips(). detectarNaSequencia()
 * permanece exportada para compatibilidade com o histórico de testes do projeto.
 */

import { CATEGORIAS, classificar, type CategoriaId, type Classificacao } from "./classificacao";
import type { TipoBip } from "./store";

export interface Spin {
  id: string;
  numero: number;
  timestamp: number;
  classificacao: Classificacao;
  /** Posição cronológica (1-based); preenchida por comRodadas durante a análise. */
  rodada?: number;
}

type Altura = "ALTO" | "BAIXO";

export type StatusSinal = "PENDENTE" | "WIN" | "RED" | "PARTIAL" | "CANCELADO";
export type TipoAlerta = "ENTRY_SIGNAL" | "WARNING" | "PAUSE" | "VALIDATION";
export type PrioridadeAlerta = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type ResultadoAuditoria = "GREEN" | "RED" | "PARTIAL" | "AWAITING" | "NO_BET";

export const PALETA_BIP = {
  repeticao: "#28a745",
  quebra: "#dc3545",
  sessao: "#6f42c1",
  cobertura: "#fd7e14",
  bloqueio: "#343a40",
  validacao: "#007bff",
} as const;

export interface Sinal {
  id: string;
  categoria: CategoriaId;
  categoriaLabel: string;
  alvo: string;
  sequenciaInicial: number;
  quebra: string;
  quebraRodadas: number;
  retorno: string;
  rodada: number;
  spinId: string;
  numero: number;
  timestamp: number;
  resultadoSeguinte: string | null;
  numeroSeguinte: number | null;
  status: StatusSinal;

  action: "SHOW_POPUP";
  type: TipoAlerta;
  colorCode: string;
  title: string;
  message: string;
  priority: PrioridadeAlerta;
  mainAction: string;
  coverageText: string | null;
  sessionPreference: string | null;
  excludeText: string | null;
  footerNote: string | null;
  sequenceContext: string | null;
  bip: TipoBip;
  rodadaAnterior: number | null;
  numeroAnterior: number | null;
  confidence: number;
  auditResult: ResultadoAuditoria;
  auditColor: string;
  auditMessage: string | null;
  auditTimestamp: number | null;
  auditSpinId: string | null;
  auditNumero: number | null;
  auditClasse: string | null;
  auditExpectedHeight: string | null;
  auditExpectedCoverage: string[];
  auditTargetRow: number;
  auditResultPayload: {
    target_signal_id: string;
    previous_bip_row_index: number;
    current_number: number | null;
    verdict: ResultadoAuditoria;
    reason: string;
    ui_update: { row_color: string; badge_text: string; panel_status: string };
  };
  auditExcludedSession: string | null;
}

export interface OpcoesDeteccao {
  minimo: number;
  categorias?: CategoriaId[];
}

export interface MapaBips {
  [spinId: string]: TipoBip;
}

export function criarSpin(numero: number, timestamp = Date.now()): Spin {
  return {
    id: `${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    numero,
    timestamp,
    classificacao: classificar(numero),
  };
}

/** Compatibilidade com o motor anterior. */
export function detectarNaSequencia(
  valores: string[],
  minimo: number,
  neutros: string[] = [],
): Array<{
  indice: number;
  alvo: string;
  sequenciaInicial: number;
  quebra: string;
  quebraRodadas: number;
}> {
  const saida: Array<{
    indice: number;
    alvo: string;
    sequenciaInicial: number;
    quebra: string;
    quebraRodadas: number;
  }> = [];

  let runValor: string | null = null;
  let runTam = 0;
  let armado: { alvo: string; sequencia: number; quebra: string; quebraRodadas: number } | null = null;

  for (let i = 0; i < valores.length; i++) {
    const v = valores[i]!;
    if (neutros.includes(v)) continue;

    if (v === runValor) {
      runTam += 1;
      if (armado) armado.quebraRodadas += 1;
      continue;
    }

    if (armado && armado.alvo === v) {
      saida.push({
        indice: i,
        alvo: v,
        sequenciaInicial: armado.sequencia,
        quebra: armado.quebra,
        quebraRodadas: armado.quebraRodadas,
      });
      armado = null;
      runValor = v;
      runTam = 1;
      continue;
    }

    if (armado) armado.quebraRodadas += 1;
    if (runValor !== null && runTam >= minimo) {
      armado = { alvo: runValor, sequencia: runTam, quebra: v, quebraRodadas: 1 };
    }
    runValor = v;
    runTam = 1;
  }

  return saida;
}

function prioridadeNumero(p: PrioridadeAlerta) {
  return p === "CRITICAL" ? 0 : p === "HIGH" ? 1 : p === "MEDIUM" ? 2 : 3;
}

function sinalBase(
  id: string,
  categoria: CategoriaId,
  categoriaLabel: string,
  alvo: string,
  atual: Spin,
  anterior: Spin,
  proximo: Spin | null,
  bip: TipoBip,
  type: TipoAlerta,
  colorCode: string,
  title: string,
  message: string,
  priority: PrioridadeAlerta,
  confidence: number,
): Sinal {
  const resultadoSeguinte = proximo?.classificacao[categoria] ?? null;
  return {
    id,
    categoria,
    categoriaLabel,
    alvo,
    sequenciaInicial: 0,
    quebra: "",
    quebraRodadas: 0,
    retorno: alvo,
    rodada: atual.rodada ?? 0,
    spinId: atual.id,
    numero: atual.numero,
    timestamp: atual.timestamp,
    resultadoSeguinte,
    numeroSeguinte: proximo?.numero ?? null,
    status: "PENDENTE",
    action: "SHOW_POPUP",
    type,
    colorCode,
    title,
    message,
    priority,
    mainAction: alvo,
    coverageText: null,
    sessionPreference: null,
    excludeText: null,
    footerNote: null,
    sequenceContext: null,
    bip,
    rodadaAnterior: anterior.rodada ?? null,
    numeroAnterior: anterior.numero,
    confidence,
    auditResult: "AWAITING",
    auditColor: "#6c757d",
    auditMessage: null,
    auditTimestamp: null,
    auditSpinId: null,
    auditNumero: null,
    auditClasse: null,
    auditExpectedHeight: categoria === "ab" || categoria === "duzia" ? atual.classificacao.ab : null,
    auditExpectedCoverage: [],
    auditExcludedSession: categoria === "secao" ? anterior.classificacao.secao : null,
    auditTargetRow: atual.rodada ?? 0,
    auditResultPayload: {
      target_signal_id: id,
      previous_bip_row_index: atual.rodada ?? 0,
      current_number: null,
      verdict: "AWAITING",
      reason: "Aguardando o giro atual.",
      ui_update: { row_color: "#6c757d", badge_text: "⏳ AGUARDANDO", panel_status: "AWAITING" },
    },
  };
}

function comRodadas(spin: Spin, index: number) {
  return { ...spin, rodada: index + 1 };
}

function cobertura(valor: string, prefixo: "C" | "D") {
  const numero = Number(valor.replace(prefixo, ""));
  if (!Number.isFinite(numero)) return prefixo === "C" ? "C1+C2" : "D2+D3";
  if (prefixo === "C") {
    return numero === 1 ? "C1+C2" : numero === 2 ? "C1+C2" : "C2+C3";
  }
  return numero === 1 ? "D1+D2" : numero === 2 ? "D2+D3" : "D2+D3";
}

function sessaoExcluida(secao: string) {
  return secao || "SESSÃO ANTERIOR";
}

function confidenceBR(separadoMudanca: boolean, juntoMesma: boolean, solto: boolean) {
  if (solto) return 60;
  if (separadoMudanca) return 90;
  if (juntoMesma) return 75;
  return 85;
}

function confidenceBT(mesmaCor: boolean) {
  return mesmaCor ? 75 : 85;
}

function alturaOposta(ab: string) {
  return ab === "ALTO" ? "BAIXO" : ab === "BAIXO" ? "ALTO" : ab;
}

function coberturaObrigatoria(coluna: string, duzia: string) {
  const c = coluna === "C1" ? "C1+C2" : coluna === "C3" ? "C2+C3" : "C1+C2";
  const d = duzia === "D1" ? "D1+D2" : duzia === "D3" ? "D2+D3" : "D2+D3";
  return [c, d];
}

function tipoBipLabel(bip: TipoBip) { return bip === "timer" ? "BT" : "BR"; }
function seqLonga(spins: Spin[], index: number) {
  const last = spins.slice(Math.max(0,index-3), index);
  return last.length >= 3 && last.every((s) => s.classificacao.ab === last[0]!.classificacao.ab);
}
function sequenciaBips(spins: Spin[], bips: MapaBips, index: number) {
  return spins.slice(Math.max(0, index - 3), index + 1).map((s) => bips[s.id]).filter(Boolean).map((b) => tipoBipLabel(b as TipoBip));
}
function contextoSequencial(seq: string[], bip: TipoBip, anterior: Spin) {
  const joined = seq.join("+");
  if (seq.slice(-3).every((x) => x === "BT") && seq.slice(-3).length === 3) return { title: "⚠️ SEQUÊNCIA ANÔMALA", action: "AGUARDAR BR VÁLIDO", confidence: 0, context: joined };
  if (joined.endsWith("BT+BR+BR+BT") || joined.endsWith("BR+BR+BT")) return { title: "INVERTE ALTURA", action: "ENTRAR EM " + alturaOposta(anterior.classificacao.ab), confidence: 88, context: "BR+BR→BT" };
  if (joined.endsWith("BT+BR+BT")) return { title: "REPETE FAIXA", action: "ENTRAR EM " + anterior.classificacao.ab, confidence: 75, context: "BT+BR+BT" };
  if (bip === "timer") return { title: "INVERTE ALTURA", action: "ENTRAR EM " + alturaOposta(anterior.classificacao.ab), confidence: 85, context: "BT isolado" };
  return { title: "REPETE ALTURA", action: "ENTRAR EM " + anterior.classificacao.ab, confidence: 90, context: "BR" };
}
function matrizSessoes(origem: string, sequenciaLonga: boolean) {
  const base: Record<string, [string,string]> = {
    "VOISINS DU ZERO": ["TIER", "ORPHÉLINS"],
    "VOISINS": ["TIER", "ORPHÉLINS"],
    "TIER": ["VOISINS DU ZERO", "ORPHÉLINS"],
    "ORPHÉLINS": ["TIER", "VOISINS DU ZERO"],
    "ORFÃO": ["TIER", "VOISINS DU ZERO"],
  };
  const pair = base[origem] ?? ["TIER", "VOISINS DU ZERO"];
  return sequenciaLonga ? [pair[1], pair[0]] : pair;
}

function sessaoPreferencial(
  bip: TipoBip,
  ctx: ReturnType<typeof contextoSequencial>,
  anterior: Spin,
  sequenciaLonga: boolean,
) {
  const prefs = matrizSessoes(anterior.classificacao.secao, sequenciaLonga || ctx.title === "REPETE FAIXA");
  const evitar = anterior.classificacao.secao;
  const escolhida = prefs.find((p) => p !== evitar) ?? prefs[0]!;
  return bip === "timer" ? escolhida : (prefs[0] ?? escolhida);
}


function coberturaUnica(ctx: ReturnType<typeof contextoSequencial>, bip: TipoBip, altura: Altura) {
  // COVERAGE_EXCLUSIVE_LOCK: ALTO = somente colunas; BAIXO = somente dúzias.
  // BR solto é a única exceção de cobertura mínima.
  if (ctx.title === "⚠️ SEQUÊNCIA ANÔMALA") return null;
  if (ctx.title === "BR SOLTO") return altura === "ALTO" ? "C2" : "D2";
  if (altura === "ALTO") {
    if (ctx.context === "BT isolado") return "C2 + C3";
    if (ctx.title === "REPETE FAIXA") return "C1 + C3";
    return "C1 + C2";
  }
  if (ctx.context === "BT isolado") return "D1 + D2";
  return "D2 + D3";
}

function detectarOscilacao221(spins: Spin[], index: number) {
  if (index < 4) return null;
  const categorias: Array<keyof Classificacao> = ["pi", "ab", "cor"];
  for (const categoria of categorias) {
    const vals = spins.slice(index - 4, index).map((s) => s.classificacao[categoria]);
    if (vals.length === 4 && vals[0] === vals[1] && vals[2] === vals[3] && vals[0] !== vals[2]) {
      return { categoria, alvo: vals[0]!, context: "2-2-1 Confirmed", confidence: 83 };
    }
  }
  return null;
}

function detectarRetorno211(spins: Spin[], index: number) {
  if (index < 3) return null;
  const categorias: Array<keyof Classificacao> = ["pi", "ab", "cor"];
  for (const categoria of categorias) {
    const vals = spins.slice(index - 3, index).map((s) => s.classificacao[categoria]);
    if (vals.length === 3 && vals[0] === vals[1] && vals[0] !== vals[2]) {
      return { categoria, alvo: vals[0]!, context: "2-1-1 Confirmed", confidence: 80 };
    }
  }
  return null;
}

function detectarSequenciaGeometrica(spins: Spin[], index: number) {
  if (index < 5) return null;
  const last = spins.slice(index - 5, index);
  const duzias = last.map((s) => s.classificacao.duzia);
  const colunas = last.map((s) => s.classificacao.coluna);
  if (duzias[0] !== "ZERO" && duzias.every((v) => v === duzias[0])) return { categoria: "duzia" as CategoriaId, alvo: duzias[0]!, context: "5x Dúzia Confirmada", confidence: 82 };
  if (colunas[0] !== "ZERO" && colunas.every((v) => v === colunas[0])) return { categoria: "coluna" as CategoriaId, alvo: colunas[0]!, context: "5x Coluna Confirmada", confidence: 82 };
  return null;
}

function coberturaParaCategoria(categoria: CategoriaId, alvo: string) {
  if (categoria === "coluna") return alvo;
  if (categoria === "duzia") return alvo;
  return null;
}

function entradaPertenceAoNumero(sinal: Sinal, numero: number) {
  if (numero < 0 || numero > 36) return false;
  if (sinal.categoria === "ab") return numero !== 0 && classificar(numero).ab === sinal.auditExpectedHeight;
  if (sinal.categoria === "pi") return numero !== 0 && classificar(numero).pi === sinal.alvo;
  if (sinal.categoria === "cor") return classificar(numero).cor === sinal.alvo;
  if (sinal.categoria === "coluna") return numero !== 0 && classificar(numero).coluna === sinal.alvo;
  if (sinal.categoria === "duzia") return numero !== 0 && classificar(numero).duzia === sinal.alvo;
  if (sinal.categoria === "tipo" || sinal.categoria === "secao" || sinal.categoria === "terminal" || sinal.categoria === "cavalo" || sinal.categoria === "g010" || sinal.categoria === "g2234") {
    return classificar(numero)[sinal.categoria] === sinal.alvo;
  }
  return false;
}

function alturaValida(numero: number, esperado: string | null) {
  if (numero === 0 || !esperado || esperado === "ZERO") return false;
  return classificar(numero).ab === esperado;
}

function coberturaValida(numero: number, alvo: string) {
  if (numero === 0) return false;
  const c = classificar(numero).coluna;
  const d = classificar(numero).duzia;
  const tokens = alvo.match(/C[123]|D[123]/g) ?? [];
  return tokens.some((t) => t[0] === "C" ? t === c : t === d);
}

function classeNumero(numero: number) {
  if (numero === 0) return "ZERO";
  const c = classificar(numero);
  return `${c.ab}, ${c.coluna}, ${c.duzia}`;
}

/**
 * Auditoria automática do giro seguinte.
 *
 * Cada sinal nasce no giro do BIP e é resolvido assim que o próximo número
 * é catalogado. Um sinal ainda sem giro seguinte permanece PENDENTE; depois
 * de dois giros sem resolução possível, torna-se NEUTRAL.
 */
export function auditarSinais(sinais: Sinal[], spinsEntrada: Spin[]): Sinal[] {
  const spins = spinsEntrada.map(comRodadas);

  return sinais.map((sinal) => {
    const origemIndex = spins.findIndex((s) => s.id === sinal.spinId);
    if (origemIndex < 0) return sinal;
    const atual = spins[origemIndex + 1] ?? null;
    const segundoGiro = spins[origemIndex + 2] ?? null;

    if (!atual) {
      return {
        ...sinal,
        auditResult: "AWAITING",
        auditColor: "#6c757d",
        auditMessage: null,
        auditTimestamp: null,
        auditSpinId: null,
        auditNumero: null,
        auditClasse: null,
        auditResultPayload: {
          target_signal_id: sinal.id,
          previous_bip_row_index: sinal.rodada,
          current_number: null,
          verdict: "AWAITING",
          reason: "Sinal pendente: aguardando o Giro Atual.",
          ui_update: { row_color: "#6c757d", badge_text: "⏳ AGUARDANDO", panel_status: "AWAITING" },
        },
      };
    }

    let result: ResultadoAuditoria = "RED";
    let reason = "";
    const c = classificar(atual.numero);

    // PAUSE/BLOQUEIO nunca é aposta e nunca pode consumir o giro seguinte como GREEN/RED.
    if (sinal.type === "PAUSE") {
      return {
        ...sinal,
        status: "CANCELADO",
        auditResult: "NO_BET",
        auditColor: "#6c757d",
        auditMessage: "Sem aposta: operação pausada/bloqueada.",
        auditTimestamp: null,
        auditSpinId: null,
        auditNumero: null,
        auditClasse: atual.numero === 0 ? "ZERO" : `${c.ab}, ${c.coluna}, ${c.duzia}`,
        auditResultPayload: {
          target_signal_id: sinal.id,
          previous_bip_row_index: sinal.rodada,
          current_number: null,
          verdict: "NO_BET",
          reason: "PAUSA/BLOQUEIO: nenhum resultado de aposta deve ser contabilizado.",
          ui_update: { row_color: "#6c757d", badge_text: "⏸ SEM APOSTA", panel_status: "NO_BET" },
        },
      };
    }

    // Regra de ouro: GREEN somente quando o número sorteado pertence ao conjunto da entrada.
    const pertence = entradaPertenceAoNumero(sinal, atual.numero);
    result = pertence ? "GREEN" : "RED";
    reason = pertence
      ? `Entrada ${sinal.mainAction} contém o número ${atual.numero}.`
      : `Número ${atual.numero} não pertence à entrada ${sinal.mainAction}.`;


