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
}

export type StatusSinal = "PENDENTE" | "WIN" | "RED" | "PARTIAL" | "CANCELADO";
export type TipoAlerta = "ENTRY_SIGNAL" | "WARNING" | "PAUSE" | "VALIDATION";
export type PrioridadeAlerta = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type ResultadoAuditoria = "GREEN" | "RED" | "NEUTRAL" | "PARTIAL";

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
    rodada: atual.rodada,
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
    excludeText: null,
    footerNote: null,
    sequenceContext: null,
    bip,
    rodadaAnterior: anterior.rodada,
    numeroAnterior: anterior.numero,
    confidence,
    auditResult: "NEUTRAL",
    auditColor: "#6c757d",
    auditMessage: null,
    auditTimestamp: null,
    auditSpinId: null,
    auditNumero: null,
    auditClasse: null,
    auditExpectedHeight: categoria === "ab" || categoria === "duzia" ? atual.classificacao.ab : null,
    auditExpectedCoverage: [],
    auditExcludedSession: categoria === "secao" ? anterior.classificacao.secao : null,
    auditTargetRow: atual.rodada,
    auditResultPayload: {
      target_signal_id: id,
      previous_bip_row_index: atual.rodada,
      current_number: null,
      verdict: "NEUTRAL",
      reason: "Aguardando o giro atual.",
      ui_update: { row_color: "#6c757d", badge_text: "⚪ NEUTRO", panel_status: "PENDING" },
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
export function analisarBips(spinsEntrada: Spin[], bips: MapaBips): Sinal[] {
  const spins = spinsEntrada.map(comRodadas);
  const sinais: Sinal[] = [];

  for (let i = 1; i < spins.length; i++) {
    const atual = spins[i]!;
    const anterior = spins[i - 1]!;
    const proximo = spins[i + 1] ?? null;
    const bip = bips[atual.id];
    if (!bip) continue;
    const seq = sequenciaBips(spins, bips, i);

    const categoriaBase = CATEGORIAS[0]?.id ?? ("cor" as CategoriaId);
    const categoriaLabel = CATEGORIAS[0]?.label ?? "BIP";

    // NÍVEL 0: bloqueios. Qualquer bloqueio suprime todos os demais sinais.
    const zeroAnterior = anterior.numero === 0;
    const zeroAtual = atual.numero === 0;
    const doubleBT = bip === "timer" && bips[anterior.id] === "timer";
    if (zeroAnterior || zeroAtual || doubleBT) {
      const motivo = zeroAnterior || zeroAtual ? "ZERO detectado" : "DOUBLE BT detectado";
      sinais.push(sinalBase(
        `bip#${atual.id}:pause`, categoriaBase, categoriaLabel, "PAUSA", atual, anterior,
        proximo, bip, "PAUSE", PALETA_BIP.bloqueio, "⛔ PAUSA OPERACIONAL",
        `${motivo}. Aguardar próximo número colorido.`, "CRITICAL", 100,
      ));
      continue;
    }

    const mesmaAltura = atual.classificacao.ab === anterior.classificacao.ab;
    const mesmaCor = atual.classificacao.cor === anterior.classificacao.cor;
    const separadaMudanca = atual.classificacao.tipo === "SEPARADO" &&
      atual.classificacao.secao !== anterior.classificacao.secao;
    const juntoMesma = atual.classificacao.tipo === "JUNTO" &&
      atual.classificacao.secao === anterior.classificacao.secao;
    const brSolto = bip === "rolando" && bips[anterior.id] !== "timer" && anterior.numero !== 0;

    // NÍVEL 1A: BR — sempre exige cobertura de 2 colunas + 2 dúzias.
    if (bip === "rolando") {
      const conf = confidenceBR(separadaMudanca, juntoMesma, brSolto);
      const cobertura = coberturaObrigatoria(atual.classificacao.coluna, atual.classificacao.duzia);
      const ajuste = separadaMudanca
        ? " BR SEPARADO + mudança de sessão."
        : juntoMesma ? " BR JUNTO + mesma sessão: reduzir mão." : "";
      sinais.push(sinalBase(
        `bip#${atual.id}:height-repeat`, "ab", "ALTURA", anterior.classificacao.ab,
        atual, anterior, proximo, bip, "ENTRY_SIGNAL", PALETA_BIP.repeticao,
        brSolto ? "ALTURA: REPETE — RISCO ELEVADO" : "ALTURA: REPETE",
        `Apostar na MESMA ALTURA: ${anterior.classificacao.ab}. Cobertura obrigatória: ${cobertura[0]} + ${cobertura[1]}. Não usar coluna/dúzia única. Confiança: ${conf}%.${ajuste}`,
        "HIGH", conf,
      ));
      const seqCtx = contextoSequencial(seq, bip, anterior);
      const primary = sinais[sinais.length - 1]!;
      primary.title = seqCtx.title; primary.mainAction = seqCtx.action;
      primary.confidence = seqCtx.confidence || conf; primary.sequenceContext = seqCtx.context;
      primary.footerNote = seqCtx.confidence ? seqCtx.context + " | " + seqCtx.confidence + "%" : seqCtx.context;
      primary.coverageText = "Cobrir: " + cobertura[0] + " + " + cobertura[1];
      primary.excludeText = "Exclui: " + sessaoExcluida(anterior.classificacao.secao);
      primary.message = seqCtx.action;
    } else {
      // NÍVEL 1B: BT — quebra de cor = altura oposta; mesma cor = contrarian.
      const esperado = mesmaCor ? anterior.classificacao.ab : alturaOposta(anterior.classificacao.ab);
      const conf = confidenceBT(mesmaCor);
      sinais.push(sinalBase(
        `bip#${atual.id}:height-${mesmaCor ? "repeat" : "invert"}`, "ab", "ALTURA", esperado,
        atual, anterior, proximo, bip, "ENTRY_SIGNAL",
        mesmaCor ? PALETA_BIP.cobertura : PALETA_BIP.quebra,
        mesmaCor ? "ALTURA: REPETE (CONTRARIAN)" : "ALTURA: INVERTE",
        mesmaCor
          ? `BT repete COR → Apostar MESMA ALTURA (${esperado}). NÃO entrar na quebra. Confiança: 75%.`
          : `BT quebra COR → Apostar ALTURA OPOSTA (${esperado}) à rodada anterior. Confiança: 85%.`,
        "HIGH", conf,
      ));
      const seqCtx = contextoSequencial(seq, bip, anterior);
      const primary = sinais[sinais.length - 1]!;
      primary.title = seqCtx.title; primary.mainAction = seqCtx.action;
      primary.confidence = seqCtx.confidence || conf; primary.sequenceContext = seqCtx.context;
      primary.footerNote = seqCtx.confidence ? seqCtx.context + " | " + seqCtx.confidence + "%" : seqCtx.context;
      primary.coverageText = bip === "rolando" ? "Cobrir: " + coberturaObrigatoria(atual.classificacao.coluna, atual.classificacao.duzia).join(" + ") : null;
      primary.excludeText = "Exclui: " + sessaoExcluida(anterior.classificacao.secao);
      primary.message = seqCtx.action;
    }

    // NÍVEL 1C: sessão universal, confiança fixa de 96%.
    sinais.push(sinalBase(
      `bip#${atual.id}:session`, "secao", "SESSÃO", anterior.classificacao.secao,
      atual, anterior, proximo, bip, "WARNING", PALETA_BIP.sessao,
      "SESSÃO: EXCLUSÃO PASSIVA",
      `Sessão ${sessaoExcluida(anterior.classificacao.secao)} eliminada.`,
      "LOW", 96,
    ));

    // Cobertura visual obrigatória também fica registrada no sinal BR para auditoria.
    if (bip === "rolando") {
      const cobertura = coberturaObrigatoria(atual.classificacao.coluna, atual.classificacao.duzia);
      const s = sinalBase(
        `bip#${atual.id}:coverage`, "duzia", "COLUNA/DÚZIA",
        `${cobertura[0]} + ${cobertura[1]}`, atual, anterior, proximo, bip,
        "ENTRY_SIGNAL", PALETA_BIP.cobertura, "COBERTURA: COLUNA/DÚZIA",
        `Cobrir ${cobertura[0]} E ${cobertura[1]} dentro da faixa de altura ${anterior.classificacao.ab}. É PROIBIDO apostar em coluna/dúzia única.`,
        "LOW", 85,
      );
      s.auditExpectedHeight = anterior.classificacao.ab;
      s.auditExpectedCoverage = cobertura;
      sinais.push(s);
    }

    // NÍVEL 2: validadores secundários entram na mensagem, sem popup independente.
    const paridadeIgualBR = bip === "rolando" && atual.classificacao.pi === anterior.classificacao.pi;
    const paridadeDiferenteBT = bip === "timer" && atual.classificacao.pi !== anterior.classificacao.pi && !mesmaCor;
    const ajusteParidade = paridadeIgualBR || paridadeDiferenteBT ? 2 : 0;
    const primarios = sinais.filter((s) => s.spinId === atual.id && s.priority === "HIGH" && s.type !== "PAUSE");
    for (const s of primarios) {
      s.confidence = Math.min(99, s.confidence + ajusteParidade);
      s.footerNote = (s.sequenceContext ?? "CICLO") + " | " + s.confidence + "%";
    }
  }

  return sinais.sort(
    (a, b) => a.rodada - b.rodada ||
      prioridadeNumero(a.priority) - prioridadeNumero(b.priority) ||
      a.id.localeCompare(b.id),
  );
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
        auditResult: "NEUTRAL",
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
          verdict: "NEUTRAL",
          reason: "Sinal pendente: aguardando o Giro Atual.",
          ui_update: { row_color: "#6c757d", badge_text: "⚪ PENDENTE", panel_status: "PENDING" },
        },
      };
    }

    let result: ResultadoAuditoria = "RED";
    let reason = "";
    const c = classificar(atual.numero);

    if (sinal.type === "PAUSE") {
      result = atual.numero === 0 ? "RED" : "GREEN";
      reason = result === "GREEN"
        ? "Pausa respeitada; próximo número foi colorido."
        : "Padrão de bloqueio falhou: ZERO repetido.";
    } else if (sinal.categoria === "ab") {
      result = alturaValida(atual.numero, sinal.alvo) ? "GREEN" : "RED";
      reason = result === "GREEN"
        ? `Altura ${c.ab} confirmada.`
        : `Altura esperada ${sinal.alvo}, saiu ${atual.numero === 0 ? "ZERO" : c.ab}.`;
    } else if (sinal.categoria === "duzia") {
      const hitAltura = alturaValida(atual.numero, sinal.auditExpectedHeight);
      const hitCoverage = coberturaValida(atual.numero, sinal.alvo);
      result = hitAltura && hitCoverage ? "GREEN" : hitAltura !== hitCoverage ? "PARTIAL" : "RED";
      reason = result === "GREEN"
        ? `Altura ${c.ab} e cobertura ${sinal.alvo} confirmadas.`
        : result === "PARTIAL"
          ? `Altura ${hitAltura ? "confirmada" : "não confirmada"}, mas cobertura ${hitCoverage ? "confirmada" : "fora"}.`
          : `Fora da altura e de todas as coberturas ${sinal.alvo}.`;
    } else if (sinal.categoria === "secao") {
      const hitExcluded = atual.numero !== 0 && c.secao === sinal.auditExcludedSession;
      result = hitExcluded ? "RED" : "GREEN";
      reason = hitExcluded
        ? `Resultado caiu na sessão excluída ${sinal.auditExcludedSession}; isso não invalida a cobertura principal de Altura + Coluna/Dúzia.`
        : `Sessão ${c.secao} não pertence à região excluída ${sinal.auditExcludedSession}.`;
      // O filtro de sessão é passivo: sua falha isolada nunca derruba um acerto da cobertura principal.
      if (hitExcluded) {
        const principal = sinais.filter((x) => x.spinId === sinal.spinId && (x.categoria === "ab" || x.categoria === "duzia"))
          .map((x) => x.auditResult);
        if (principal.includes("GREEN")) result = "PARTIAL";
      }
    } else if (sinal.categoria === "pi") {
      result = atual.numero !== 0 && c.pi === sinal.alvo ? "GREEN" : "RED";
      reason = `Paridade atual: ${atual.numero === 0 ? "ZERO" : c.pi}.`;
    }

    // Sinal expira após dois giros se, por alguma razão, ainda estiver pendente.
    const expira = segundoGiro !== null && sinal.auditSpinId === null && result === "NEUTRAL";
    if (expira) result = "NEUTRAL";

    const color = result === "GREEN" ? "#28a745" : result === "RED" ? "#dc3545" : result === "PARTIAL" ? "#ffc107" : "#6c757d";
    const badge = result === "GREEN" ? "✅ GREEN" : result === "RED" ? "❌ RED" : result === "PARTIAL" ? "🟡 PARCIAL" : "⚪ NEUTRO";

    return {
      ...sinal,
      status: result === "GREEN" ? "WIN" : result === "PARTIAL" ? "PARTIAL" : result === "RED" ? "RED" : "CANCELADO",
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
        ui_update: { row_color: color, badge_text: badge, panel_status: result === "GREEN" || result === "PARTIAL" ? "WIN" : result },
      },
    };
  });
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
