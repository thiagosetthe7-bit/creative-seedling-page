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
export type ResultadoAuditoria = "GREEN" | "RED" | "PARTIAL" | "AWAITING" | "NO_BET" | "INVALID";
export type RegimeClassificado = "LIMPA" | "HOSTIL";
export type MotivoHostil = "ZERO" | "RAJADA" | "SATURACAO" | "nenhum";

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
  regimeClassificado: RegimeClassificado;
  motivoHostil: MotivoHostil;
  gale1Liberado: boolean;
  gale1Usado: boolean;
  gale1Resultado: "GREEN" | "RED" | "n/a";
  gale2Usado: boolean;
  gale2Resultado: "GREEN" | "RED" | "n/a";
  unidadesLiquidasSequencia: number;
  observacaoHostil: boolean;
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
    regimeClassificado: "LIMPA",
    motivoHostil: "nenhum",
    gale1Liberado: true,
    gale1Usado: false,
    gale1Resultado: "n/a",
    gale2Usado: false,
    gale2Resultado: "n/a",
    unidadesLiquidasSequencia: 0,
    observacaoHostil: false,
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

function normalizarEntrada(entrada: string) {
  let texto = String(entrada ?? "")
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toUpperCase()
    .replace(/^\\s*(ENTRAR\\s+EM|ENTRADA\\s*:|SINAL\\s*:|APUESTA\\s+)/, "")
    .replace(/\\s+/g, " ")
    .trim();

  const aliases: Array<[string, string, CategoriaId]> = [
    ["IMPAR", "IMPAR", "pi"], ["PAR", "PAR", "pi"],
    ["VERMELHO", "VERMELHO", "cor"], ["PRETO", "PRETO", "cor"], ["VERDE", "VERDE", "cor"],
    ["ALTO", "ALTO", "ab"], ["BAIXO", "BAIXO", "ab"],
    ["C1", "C1", "coluna"], ["C2", "C2", "coluna"], ["C3", "C3", "coluna"],
    ["D1", "D1", "duzia"], ["D2", "D2", "duzia"], ["D3", "D3", "duzia"],
    ["JUNTO", "JUNTO", "tipo"], ["SEPARADO", "SEPARADO", "tipo"],
  ];

  const exact = aliases.find(([label]) => texto === label);
  if (exact) return { categoria: exact[2], valor: exact[1] };

  const categoriaAliases: Array<[string, CategoriaId]> = [
    ["TERMINAL", "terminal"], ["CAVALO", "cavalo"], ["TIPO", "tipo"],
    ["SECAO", "secao"], ["VIZINHOS 0", "g010"], ["0/10", "g010"],
    ["VIZINHOS 22", "g2234"], ["VIZINHOS 34", "g2234"], ["22/34", "g2234"],
    ["ESPELHO", "g010"], ["LADO", "secao"], ["RUA", "secao"], ["LINHA", "secao"],
  ];
  for (const [prefix, categoria] of categoriaAliases) {
    if (texto.startsWith(prefix + " ")) return { categoria, valor: texto };
  }

  return null;
}

function entradaCanonicaDoSinal(sinal: Sinal) {
  const raw = sinal.mainAction;
  const normalizada = normalizarEntrada(raw);
  if (normalizada) return normalizada;

  // Para sinais em que a entrada é construída por estratégia, usa a dimensão
  // já definida pelo próprio motor, sem comparar o texto livre.
  if (sinal.categoria === "ab" && sinal.auditExpectedHeight) {
    return { categoria: "ab" as CategoriaId, valor: sinal.auditExpectedHeight };
  }
  if (sinal.categoria === "pi" || sinal.categoria === "cor" || sinal.categoria === "coluna" || sinal.categoria === "duzia" || sinal.categoria === "tipo" || sinal.categoria === "secao" || sinal.categoria === "terminal" || sinal.categoria === "cavalo" || sinal.categoria === "g010" || sinal.categoria === "g2234") {
    return { categoria: sinal.categoria, valor: sinal.alvo };
  }
  return null;
}

function entradaPertenceAoNumero(sinal: Sinal, numero: number) {
  const entrada = entradaCanonicaDoSinal(sinal);
  if (!entrada || numero < 0 || numero > 36) return null;
  if (numero === 0 && ["pi","ab","coluna","duzia"].includes(entrada.categoria)) return false;

  const classificacao = classificar(numero);
  const valor = entrada.valor;

  if (entrada.categoria === "cor") return classificacao.cor === valor;
  if (entrada.categoria === "pi") return numero !== 0 && classificacao.pi === valor;
  if (entrada.categoria === "ab") return numero !== 0 && classificacao.ab === valor;
  if (entrada.categoria === "coluna") return numero !== 0 && classificacao.coluna === valor;
  if (entrada.categoria === "duzia") return numero !== 0 && classificacao.duzia === valor;
  return classificacao[entrada.categoria] === valor;
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

    // ZERO nunca é GREEN/RED: é SEM APOSTA e não consome o giro como resultado.
    if (atual.numero === 0) {
      return {
        ...sinal,
        status: "CANCELADO",
        auditResult: "NO_BET",
        auditColor: "#6c757d",
        auditMessage: "⏸ SEM APOSTA",
        auditTimestamp: atual.timestamp,
        auditSpinId: null,
        auditNumero: null,
        auditClasse: "ZERO",
        auditResultPayload: {
          target_signal_id: sinal.id,
          previous_bip_row_index: sinal.rodada,
          current_number: null,
          verdict: "NO_BET",
          reason: "ZERO: giro não pontua e não é consumido como resultado de aposta.",
          ui_update: { row_color: "#6c757d", badge_text: "⏸ SEM APOSTA", panel_status: "NO_BET" },
        },
      };
    }

    // Regra de ouro: GREEN somente quando o número sorteado pertence ao conjunto da entrada.
    const pertence = entradaPertenceAoNumero(sinal, atual.numero);
    if (pertence === null) {
      return {
        ...sinal,
        status: "CANCELADO",
        auditResult: "INVALID",
        auditColor: "#f59e0b",
        auditMessage: "⚠️ ENTRADA NÃO RECONHECIDA",
        auditTimestamp: atual.timestamp,
        auditSpinId: atual.id,
        auditNumero: null,
        auditClasse: classeNumero(atual.numero),
        auditResultPayload: {
          target_signal_id: sinal.id,
          previous_bip_row_index: sinal.rodada,
          current_number: null,
          verdict: "INVALID",
          reason: "A entrada não pôde ser normalizada para uma dimensão e valor canônicos.",
          ui_update: { row_color: "#f59e0b", badge_text: "⚠️ ENTRADA NÃO RECONHECIDA", panel_status: "INVALID" },
        },
      };
    }
    result = pertence ? "GREEN" : "RED";
    reason = pertence
      ? `Entrada ${sinal.mainAction} contém o número ${atual.numero}.`
      : `Número ${atual.numero} não pertence à entrada ${sinal.mainAction}.`;

    const color = result === "GREEN" ? "#28a745" : "#dc3545";
    const badge = result === "GREEN" ? "✅ GREEN" : "❌ RED";

    return {
      ...sinal,
      status: result === "GREEN" ? "WIN" : "RED",
      auditResult: result,
      auditColor: color,
      auditMessage: `Resultado: ${atual.numero} (${atual.numero === 0 ? "ZERO" : `${c.ab}, ${c.coluna}, ${c.duzia}`})`,
      auditTimestamp: atual.timestamp,
      auditSpinId: atual.id,
      auditNumero: atual.numero,
      auditClasse: atual.numero === 0 ? "ZERO" : `${c.ab}, ${c.coluna}, ${c.duzia}`,
      auditResultPayload: {
        target_signal_id: sinal.id,
        previous_bip_row_index: sinal.rodada,
        current_number: atual.numero,
        verdict: result,
        reason,
        ui_update: { row_color: color, badge_text: badge, panel_status: result === "GREEN" ? "WIN" : result },
      },
    };
  });
}

/**
 * Estratégia oficial BIP ANALYZER.
 *
 * Para cada rodada marcada com BT (bip no timer) ou BR (bip rolando), compara
 * a rodada anterior com o BIP atual e gera os alertas visuais operacionais.
 * Prioridade: Bloqueio > Altura > Sessão > Coluna/Dúzia > Validação.
 */
export interface PortaoGale {
  regimeClassificado: RegimeClassificado;
  motivoHostil: MotivoHostil;
  gale1Liberado: boolean;
  zeroRecente: boolean;
  rajada: boolean;
  saturacao: boolean;
  janela: number;
}

export function classificarRegimeJanela(spins: Spin[], bips: MapaBips, index: number, janela = 14, limiarSat = 0.70): PortaoGale {
  const inicio = Math.max(0, index - janela + 1);
  const w = spins.slice(inicio, index + 1);
  const n = w.length || 1;
  const zeroRecente = w.some((s) => s.numero === 0);
  let rajada = false;
  for (let j = 1; j < w.length; j++) {
    if (bips[w[j - 1]!.id] && bips[w[j]!.id]) { rajada = true; break; }
  }
  const counts: Record<string, number> = {};
  for (const s of w) {
    if (s.numero === 0) continue;
    for (const key of ["ab", "cor", "pi"] as const) {
      const value = s.classificacao[key];
      if (value && value !== "ZERO") {
        const k = key + ":" + value;
        counts[k] = (counts[k] ?? 0) + 1;
      }
    }
  }
  const saturacao = Object.values(counts).some((count) => count / n >= limiarSat);
  const motivoHostil: MotivoHostil = zeroRecente ? "ZERO" : rajada ? "RAJADA" : saturacao ? "SATURACAO" : "nenhum";
  return { regimeClassificado: motivoHostil === "nenhum" ? "LIMPA" : "HOSTIL", motivoHostil, gale1Liberado: motivoHostil === "nenhum", zeroRecente, rajada, saturacao, janela: w.length };
}

export function analisarBips(spinsEntrada: Spin[], bips: MapaBips): Sinal[] {
  const spins = spinsEntrada.map(comRodadas);
  const sinais: Sinal[] = [];

  for (let i = 1; i < spins.length; i++) {
    const atual = spins[i]!;
    const bip = bips[atual.id];
    if (!bip) continue;

    const anterior = spins[i - 1]!;
    const proximo = spins[i + 1] ?? null;
    const cA = anterior.classificacao;
    const ctx = contextoSequencial(sequenciaBips(spins, bips, i), bip, anterior);
    const regime = classificarRegimeJanela(spins, bips, i, 14, 0.70);

    // BLOQUEIO — Double BT: dois bips no timer seguidos bloqueiam a operação.
    if (bip === "timer" && bips[anterior.id] === "timer") {
      sinais.push(sinalBase(
        `${atual.id}-bloqueio`, "ab", "A/B", "AGUARDAR",
        atual, anterior, proximo, bip, "PAUSE", PALETA_BIP.bloqueio,
        "⛔ BLOQUEIO: DOUBLE BT",
        "Dois BIPs no TIMER em sequência. Bloqueio total: aguarde um BR válido antes de operar.",
        "CRITICAL", 0,
      ));
      continue;
    }

    // BLOQUEIO — ZERO estendido: após qualquer ZERO, aguarde 2 giros coloridos válidos.
    let zeroRecente = false;
    let coloridosAposZero = 0;
    for (let z = i - 1; z >= 0; z--) {
      if (spins[z]!.numero === 0) {
        zeroRecente = true;
        break;
      }
      coloridosAposZero++;
    }
    if (atual.numero === 0 || (zeroRecente && coloridosAposZero < 2)) {
      sinais.push(sinalBase(
        `${atual.id}-pausa`, "ab", "A/B", "PAUSAR",
        atual, anterior, proximo, bip, "PAUSE", PALETA_BIP.bloqueio,
        "⛔ PAUSA OPERACIONAL",
        "ZERO detectado na rodada anterior. Nenhuma entrada neste giro: aguarde o próximo número.",
        "CRITICAL", 0,
      ));
      continue;
    }

    // BLOQUEIO — sequência anômala de bips (BT+BT+BT).
    if (ctx.title === "⚠️ SEQUÊNCIA ANÔMALA") {
      sinais.push(sinalBase(
        `${atual.id}-anomalia`, "ab", "A/B", "AGUARDAR",
        atual, anterior, proximo, bip, "PAUSE", PALETA_BIP.bloqueio,
        "⚠️ SEQUÊNCIA ANÔMALA",
        `Sequência ${ctx.context}: aguardar BR válido antes de qualquer entrada.`,
        "CRITICAL", 0,
      ));
      continue;
    }

    const mesmaCor = atual.numero !== 0 && atual.classificacao.cor === cA.cor;
    const mesmaParidade = atual.numero !== 0 && atual.classificacao.pi === cA.pi;

    // v6.5 — auditor rígido: prioridade 2-2-1 > 2-1-1 > BR/BT > sequência geométrica.
    const oscilacao221 = detectarOscilacao221(spins, i);
    const retorno211 = detectarRetorno211(spins, i);
    const geometrica = detectarSequenciaGeometrica(spins, i);
    const origem = cA.secao;
    const sequenciaLonga = seqLonga(spins, i);
    const ultimos = spins.slice(Math.max(0, i - 5), i);
    const alternanciaPerfeita = ultimos.length >= 4 && ultimos.slice(-4).every((s, idx, arr) => idx === 0 || s.classificacao.ab !== arr[idx - 1]!.classificacao.ab);
    const runAntes = ultimos.length ? ultimos[ultimos.length - 1]!.classificacao.ab : null;
    let titulo = "";
    let acao = "";
    let conf = 0;
    let cobertura: string | null = null;
    let categoriaAuditoria: CategoriaId = "ab";
    let nota = "";
    const alturaAlvo = (ctx.title === "INVERTE ALTURA" ? alturaOposta(cA.ab) : cA.ab) as Altura;

    // Bloqueios v6.5: alternância A-B-A-B e retornos 3-1-1/4-1-1.
    if (alternanciaPerfeita) {
      continue;
    }
    const runAtual = runAntes ? ultimos.slice().reverse().findIndex((s) => s.classificacao.ab !== runAntes) : -1;
    const repeticoes = runAntes ? (runAtual < 0 ? ultimos.length : runAtual) : 0;
    if (repeticoes >= 3 && ultimos.length >= repeticoes + 1) {
      continue;
    }

    const janela = spins.slice(Math.max(0, i - 13), i + 1);
    const naoZero = janela.filter((s) => s.numero !== 0);
    const alturaSaturada = naoZero.length > 0 && ["ALTO","BAIXO"].some((v) => naoZero.filter((s) => s.classificacao.ab === v).length / Math.max(1, regime.janela) >= 0.70);
    const bipAnterior = i > 0 ? bips[spins[i - 1]!.id] : undefined;
    const bipAnterior2 = i > 1 ? bips[spins[i - 2]!.id] : undefined;
    const bipIsolado = bip === "rolando" && !bipAnterior;
    const brSeparado = bip === "rolando" && bipIsolado && origem === "TIER" && atual.classificacao.tipo === "SEPARADO" && !alturaSaturada;
    const btQuebra = bip === "timer" && !mesmaCor && !sequenciaLonga && atual.classificacao.secao === cA.secao && bipAnterior2 !== "timer";
    if (oscilacao221 && (atual.classificacao[oscilacao221.categoria] === oscilacao221.alvo)) {
      categoriaAuditoria = oscilacao221.categoria;
      conf = 83;
      nota = "OSCILAÇÃO 2-2-1 CONFIRMADA";
      if (oscilacao221.categoria === "ab") {
        acao = "ENTRAR EM " + oscilacao221.alvo;
        cobertura = oscilacao221.alvo === "ALTO" ? "C2+C3" : "D1+D2";
      } else {
        acao = "ENTRAR EM " + oscilacao221.alvo;
        cobertura = oscilacao221.alvo;
      }
      titulo = "OSCILAÇÃO 2-2-1 · 84%";
    } else if (retorno211 && (atual.classificacao[retorno211.categoria] === retorno211.alvo)) {
      categoriaAuditoria = retorno211.categoria;
      conf = 80;
      nota = "RETORNO 2-1-1 CONFIRMADO";
      if (retorno211.categoria === "ab") {
        acao = "ENTRAR EM " + retorno211.alvo;
        cobertura = retorno211.alvo === "ALTO" ? "C2+C3" : "D1+D2";
      } else {
        acao = "ENTRAR EM " + retorno211.alvo;
        cobertura = retorno211.alvo;
      }
      titulo = "RETORNO 2-1-1 · 81%";
    } else {
      if (brSeparado) {
        titulo = "BR SEPARADO · REPETE ALTURA";
        acao = "ENTRAR EM " + alturaAlvo;
        conf = mesmaParidade ? 86 : 86;
        cobertura = alturaAlvo === "ALTO" ? "C2+C3" : "D1+D2";
        nota = mesmaParidade ? "BR Separado + Parity" : "BR Separado";
      } else if (btQuebra) {
        titulo = "BT QUEBRA COR · INVERSÃO · 81%";
        acao = "ENTRAR EM " + alturaOposta(cA.ab);
        conf = 81;
        cobertura = acao.includes("ALTO") ? "D2+D3" : "D1+D2";
        nota = "BT Quebra Cor";
      } else if (geometrica) {
        categoriaAuditoria = geometrica.categoria;
        conf = 82;
        acao = "ENTRAR EM " + geometrica.alvo;
        cobertura = geometrica.alvo;
        titulo = "SEQUÊNCIA GEOMÉTRICA 5x · 82%";
        nota = geometrica.context;
      } else {
        continue;
      }
    }

    // v6.6+ — inteligência pós-BIP: bônus somente como modificador, nunca como gatilho.
    const bipValido = bip === "timer" || bip === "rolando";
    const varsRepetidas = [
      atual.classificacao.cor === anterior.classificacao.cor,
      atual.classificacao.pi === anterior.classificacao.pi,
      atual.classificacao.ab === anterior.classificacao.ab,
      atual.classificacao.tipo === anterior.classificacao.tipo,
    ].filter(Boolean).length;
    const spinsPosBip = spins.slice(Math.max(0, i - 3), i);
    const mesmaCor3 = spinsPosBip.length >= 3 && spinsPosBip.slice(-3).every((s) => s.classificacao.cor === atual.classificacao.cor);
    const gold = bipValido && atual.classificacao.cor === anterior.classificacao.cor && atual.classificacao.pi === anterior.classificacao.pi && (varsRepetidas >= 3 || spinsPosBip.length >= 2);
    const silver = bipValido && !gold && atual.classificacao.cor === anterior.classificacao.cor;
    const exclusaoFisica = bipValido && mesmaCor3;
    if (conf >= 78 && gold) {
      conf = Math.min(conf + 7, 86);
      nota = "🔥 ALTA CONFIANÇA: Cor+Paridade alinhadas pós-BIP.";
    } else if (conf >= 78 && silver) {
      conf = Math.min(conf + 4, 86);
      nota = "⚡ CONFIANÇA MODERADA: Cor mantida pós-BIP.";
    }
    if (exclusaoFisica && conf >= 78) {
      cobertura = null;
      nota = "🚫 FILTRO FÍSICO: combinação setor+cor em exaustão.";
    }

    // Se uma sequência >=4 já estiver presente em um gatilho BR/BT, reduzir para cobertura única.
    const coberturaReducao = bip !== undefined && ultimos.length >= 4 && ultimos.slice(-4).every((s) => s.classificacao.ab === ultimos[ultimos.length - 1]!.classificacao.ab);
    if (coberturaReducao && (bip === "rolando" || bip === "timer")) {
      if (categoriaAuditoria === "ab") cobertura = alturaAlvo === "ALTO" ? "C2" : "D2";
      else if (categoriaAuditoria === "duzia" || categoriaAuditoria === "coluna") cobertura = categoriaAuditoria === "duzia" ? cA.duzia : cA.coluna;
    }

    const permitidas = acao.includes("ALTO")
      ? ["C2+C3", "D2+D3"]
      : acao.includes("BAIXO")
        ? ["D1+D2", "C1+C2"]
        : [];

    const alinhada = categoriaAuditoria === "ab"
      ? cobertura !== null && permitidas.includes(cobertura)
      : cobertura !== null;

    const strategy = titulo.startsWith("OSCILAÇÃO") ? "OSCILACAO_221"
      : titulo.startsWith("BR SEPARADO") ? "BR_SEPARADO"
      : titulo.startsWith("BT QUEBRA") ? "BT_QUEBRA_COR"
      : titulo.startsWith("RETORNO") ? "RETORNO_211"
      : titulo.startsWith("SEQUÊNCIA") ? "SEQUENCIA_GEOMETRICA_5X" : "OUTRA";

    let observacaoHostil = false;
    let observacaoMotivo = "";

    if (strategy === "BR_SEPARADO" && (!bipIsolado || origem !== "TIER" || atual.classificacao.tipo !== "SEPARADO" || alturaSaturada)) {
      observacaoHostil = true;
      observacaoMotivo = "BIP/Tipo/Altura fora da condição";
    }
    if (regime.regimeClassificado === "HOSTIL" && (strategy === "OSCILACAO_221" || strategy === "RETORNO_211")) {
      observacaoHostil = true;
      observacaoMotivo = "regime hostil";
    }
    if (strategy === "BT_QUEBRA_COR" && atual.classificacao.secao !== cA.secao) {
      observacaoHostil = true;
      observacaoMotivo = "troca brusca de seção";
    }

    if (bip === "rolando" && !geometrica && !oscilacao221 && !retorno211 &&
        (!bipIsolado || origem !== "TIER" || atual.classificacao.tipo !== "SEPARADO" || alturaSaturada)) {
      titulo = "BR SEPARADO · REPETE ALTURA";
      acao = "ENTRAR EM " + alturaAlvo;
      conf = 86;
      categoriaAuditoria = "ab";
      cobertura = alturaAlvo === "ALTO" ? "C2+C3" : "D1+D2";
      observacaoHostil = true;
      observacaoMotivo = "BIP/Tipo/Altura fora da condição";
    }

    const bloqueado = conf < 78 || !alinhada;
    if (bloqueado && !observacaoHostil) continue;

    const operacional = !observacaoHostil && conf >= 78 && alinhada;
    const s = sinalBase(
      atual.id + "-v67", categoriaAuditoria, "ENTRADA ÚNICA", acao,
      atual, anterior, proximo, bip, "ENTRY_SIGNAL",
      PALETA_BIP.repeticao,
      titulo,
      "",
      "HIGH", conf
    );    s.mainAction = acao;
    s.coverageText = cobertura;
    s.regimeClassificado = regime.regimeClassificado;
    s.motivoHostil = regime.motivoHostil;
    s.gale1Liberado = operacional && regime.gale1Liberado;
    s.observacaoHostil = !operacional;
    s.gale1Usado = false;
    s.gale1Resultado = "n/a";
    s.gale2Usado = false;
    s.gale2Resultado = "n/a";
    s.unidadesLiquidasSequencia = 0;
    if (s.observacaoHostil) {
      s.title = "👁 OBSERVAÇÃO · " + s.title;
      s.message = "Stake 0 · " + (observacaoMotivo || "condição de regime");
      s.footerNote = "👁 OBSERVAÇÃO | " + (observacaoMotivo || "regime hostil") + " | 🔒 GALE 1 BLOQUEADO";
    } else {
      s.message = regime.gale1Liberado
        ? "🔓 GALE 1 LIBERADO — janela limpa"
        : "🔒 GALE 1 BLOQUEADO — regime hostil (motivo: " + regime.motivoHostil + ")";
      s.footerNote = (s.footerNote ?? "") + " | " + (regime.gale1Liberado
        ? "🔓 GALE 1 LIBERADO — janela limpa"
        : "🔒 GALE 1 BLOQUEADO — regime hostil (motivo: " + regime.motivoHostil + ")");
    }
    s.sessionPreference = conf > 0 ? sessaoPreferencial(bip, ctx, anterior, sequenciaLonga) : null;
    s.sequenceContext = ctx.context;
    const confirmador = brSeparado && mesmaParidade ? "✔️ Paridade Confirmada" : btQuebra && !mesmaCor ? "✔️ Cor Confirmada" : null;
    s.footerNote = nota ? `${nota} | Conf: ${conf}%` : (confirmador ? `${confirmador} | Conf: ${conf}%` : `Conf: ${conf}%`);
    s.auditExpectedHeight = categoriaAuditoria === "ab" ? (acao.includes("ALTO") ? "ALTO" : acao.includes("BAIXO") ? "BAIXO" : alturaAlvo) : null;
    s.auditExpectedCoverage = cobertura ? [cobertura] : [];
    sinais.push(s);
  }

  return sinais.sort(
    (a, b) => a.timestamp - b.timestamp || prioridadeNumero(a.priority) - prioridadeNumero(b.priority),
  );
}

/** Compatibilidade: a estratégia nova não usa mais detecção por sequência. */
export function detectarSinais(spins: Spin[], _opcoes: OpcoesDeteccao): Sinal[] {
  return analisarBips(spins, {});
}

export interface Estatisticas {
  total: number;
  win: number;
  red: number;
  partial: number;
  score: number;
  pendentes: number;
  cancelados: number;
  taxaWin: number;
  taxaRed: number;
  maiorSeqWin: number;
  maiorSeqRed: number;
  ultimo: Sinal | null;
}

export function calcularEstatisticas(sinais: Sinal[]): Estatisticas {
  let win = 0;
  let red = 0;
  let partial = 0;
  let pendentes = 0;
  let cancelados = 0;
  let seqWin = 0;
  let seqRed = 0;
  let maiorSeqWin = 0;
  let maiorSeqRed = 0;

  for (const s of sinais) {
    if (s.status === "WIN") {
      win++;
      seqWin++;
      seqRed = 0;
      maiorSeqWin = Math.max(maiorSeqWin, seqWin);
    } else if (s.status === "PARTIAL") {
      partial++;
      seqWin = 0;
      seqRed = 0;
    } else if (s.status === "RED") {
      red++;
      seqRed++;
      seqWin = 0;
      maiorSeqRed = Math.max(maiorSeqRed, seqRed);
    } else if (s.status === "PENDENTE") {
      pendentes++;
    } else {
      cancelados++;
    }
  }

  const resolvidos = win + red + partial;
  const score = win + partial * 0.5;
  return {
    total: sinais.length,
    win,
    red,
    partial,
    score,
    pendentes,
    cancelados,
    taxaWin: resolvidos ? (score / resolvidos) * 100 : 0,
    taxaRed: resolvidos ? (red / resolvidos) * 100 : 0,
    maiorSeqWin,
    maiorSeqRed,
    ultimo: sinais.length ? sinais[sinais.length - 1]! : null,
  };
}


/** Formato tabular para auditoria/exportação do log lateral. */
export function gerarLogAuditoriaCSV(sinais: Sinal[]): string {
  const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const header = [
    "Signal ID","Strategy Name","Suggested Entry","Actual Result Number","Outcome Status","Confidence","Timestamp",
    "regime_classificado","motivo_hostil","gale1_librado","gale1_usado","gale1_resultado","gale2_usado","gale2_resultado","unidades_liquidas_da_sequencia"
  ];
  const rows = sinais
    .filter((s) => s.auditNumero !== null && ["GREEN","RED","PARTIAL"].includes(s.auditResult))
    .map((s) => [
      s.id, s.title, s.mainAction, s.auditNumero ?? "INCOMPLETO",
      s.auditResult === "GREEN" ? "GREEN" : s.auditResult === "RED" ? "RED" : "PARTIAL",
      s.confidence, s.auditTimestamp ?? "",
      s.regimeClassificado, s.motivoHostil, s.gale1Liberado ? "S" : "N", s.gale1Usado ? "S" : "N",
      s.gale1Resultado, s.gale2Usado ? "S" : "N", s.gale2Resultado, s.unidadesLiquidasSequencia
    ]);
  return [header, ...rows].map((row) => row.map(esc).join(",")).join("\n");
}
