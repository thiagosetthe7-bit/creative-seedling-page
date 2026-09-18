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

export type StatusSinal = "PENDENTE" | "WIN" | "RED" | "CANCELADO";
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

function confidenceBR(repetiuAltura: boolean) {
  return repetiuAltura ? 96 : 88;
}

function confidenceBT(mesmaCor: boolean) {
  return mesmaCor ? 94 : 90;
}

/**
 * Gerador oficial do BIP ANALYZER.
 *
 * Ordem absoluta:
 * BLOQUEIO > ALTURA > SESSÃO > COLUNA/DÚZIA > VALIDAÇÃO
 *
 * Zero na rodada anterior ou BT consecutivo bloqueia o processamento e produz
 * somente o alerta cinza.
 */
export function analisarBips(spinsEntrada: Spin[], bips: MapaBips): Sinal[] {
  const spins = spinsEntrada.map(comRodadas);
  const sinais: Sinal[] = [];

  for (let i = 1; i < spins.length; i++) {
    const atual = spins[i]!;
    const anterior = spins[i - 1]!;
    const proximo = spins[i + 1] ?? null;
    const bip = bips[atual.id];
    if (!bip) continue;

    const categoriaBase = CATEGORIAS[0]?.id ?? ("cor" as CategoriaId);
    const categoriaLabel = CATEGORIAS[0]?.label ?? "BIP";

    // 1. BLOQUEIO — nada mais pode ser emitido nesta rodada.
    const zeroAnterior = anterior.numero === 0;
    const doubleBT = bip === "timer" && bips[anterior.id] === "timer";
    if (zeroAnterior || doubleBT) {
      const motivo = zeroAnterior
        ? "ZERO detectado"
        : "DOUBLE BT detectado";
      sinais.push(
        sinalBase(
          `bip#${atual.id}:pause`,
          categoriaBase,
          categoriaLabel,
          "PAUSA",
          atual,
          anterior,
          proximo,
          bip,
          "PAUSE",
          PALETA_BIP.bloqueio,
          "⛔ PAUSA OPERACIONAL",
          `${motivo}. Aguardar próximo número colorido.`,
          "CRITICAL",
          100,
        ),
      );
      continue;
    }

    const mesmaAltura = atual.classificacao.ab === anterior.classificacao.ab;
    const mesmaCor = atual.classificacao.cor === anterior.classificacao.cor;

    // 2. ALTURA — verde para repetição, vermelho para inversão.
    if (bip === "rolando") {
      if (mesmaAltura) {
        sinais.push(
          sinalBase(
            `bip#${atual.id}:height-repeat`,
            "ab",
            "ALTURA",
            atual.classificacao.ab,
            atual,
            anterior,
            proximo,
            bip,
            "ENTRY_SIGNAL",
            PALETA_BIP.repeticao,
            "ALTURA: REPETE",
            `Entrar em ${atual.classificacao.ab}. Confiança: ${confidenceBR(true)}%.`,
            "HIGH",
            confidenceBR(true),
          ),
        );
      } else {
        sinais.push(
          sinalBase(
            `bip#${atual.id}:height-invert`,
            "ab",
            "ALTURA",
            atual.classificacao.ab,
            atual,
            anterior,
            proximo,
            bip,
            "ENTRY_SIGNAL",
            PALETA_BIP.quebra,
            "ALTURA: INVERTE",
            `Entrar em ${atual.classificacao.ab}. Confiança: ${confidenceBR(false)}%.`,
            "HIGH",
            confidenceBR(false),
          ),
        );
      }
    } else {
      const titulo = mesmaCor ? "ALTURA: REPETE (CONTRARIAN)" : "ALTURA: INVERTE";
      const mensagem = mesmaCor
        ? "BT repete COR → Apostar REPETIÇÃO DE ALTURA. NÃO entrar na quebra."
        : `BT quebra COR → Apostar INVERSÃO DE ALTURA. Confiança: ${confidenceBT(false)}%.`;
      sinais.push(
        sinalBase(
          `bip#${atual.id}:height-${mesmaCor ? "repeat" : "invert"}`,
          "ab",
          "ALTURA",
          atual.classificacao.ab,
          atual,
          anterior,
          proximo,
          bip,
          "ENTRY_SIGNAL",
          mesmaCor ? PALETA_BIP.repeticao : PALETA_BIP.quebra,
          titulo,
          mensagem,
          "HIGH",
          confidenceBT(mesmaCor),
        ),
      );
    }

    // 3. SESSÃO — sempre acompanha um BIP válido.
    sinais.push(
      sinalBase(
        `bip#${atual.id}:session`,
        "secao",
        "SESSÃO",
        atual.classificacao.secao,
        atual,
        anterior,
        proximo,
        bip,
        "WARNING",
        PALETA_BIP.sessao,
        "SESSÃO: MUDANÇA OBRIGATÓRIA",
        `Excluir região ${sessaoExcluida(anterior.classificacao.secao)} da aposta.`,
        "HIGH",
        88,
      ),
    );

    // 4. COBERTURA — BR + repetição de altura.
    if (bip === "rolando" && mesmaAltura) {
      const c = cobertura(atual.classificacao.coluna, "C");
      const d = cobertura(atual.classificacao.duzia, "D");
      sinais.push(
        sinalBase(
          `bip#${atual.id}:coverage`,
          "duzia",
          "COLUNA/DÚZIA",
          `${c} + ${d}`,
          atual,
          anterior,
          proximo,
          bip,
          "ENTRY_SIGNAL",
          PALETA_BIP.cobertura,
          "COBERTURA: COLUNA/DÚZIA",
          `Cobrir ${c} E ${d} dentro da faixa de altura. NÃO apostar em coluna única.`,
          "MEDIUM",
          85,
        ),
      );
    }

    // 5. VALIDAÇÃO — baixa prioridade e visual secundário.
    const paridadeIgual = atual.classificacao.pi === anterior.classificacao.pi;
    const tipoSeparado = atual.classificacao.tipo === "SEPARADO";
    if (paridadeIgual || tipoSeparado) {
      const paridade = paridadeIgual ? "IGUAL" : "DIFERENTE";
      const conf = paridadeIgual ? 97 : 91;
      sinais.push(
        sinalBase(
          `bip#${atual.id}:validation`,
          "pi",
          "VALIDADOR",
          atual.classificacao.pi,
          atual,
          anterior,
          proximo,
          bip,
          "VALIDATION",
          PALETA_BIP.validacao,
          "✅ VALIDADOR ATIVO",
          `Paridade ${paridade} confirmada. Assertividade aumentada para ${conf}%.`,
          "LOW",
          conf,
        ),
      );
    }
  }

  return sinais.sort(
    (a, b) =>
      a.rodada - b.rodada ||
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
  const porId = new Map(spins.map((s) => [s.id, s]));

  return sinais.map((sinal) => {
    const origem = porId.get(sinal.spinId);
    if (!origem) return sinal;

    const origemIndex = spins.findIndex((s) => s.id === sinal.spinId);
    const atual = origemIndex >= 0 ? spins[origemIndex + 1] ?? null : null;
    const segundoGiro = origemIndex >= 0 ? spins[origemIndex + 2] ?? null : null;

    if (!atual) {
      return { ...sinal, status: "PENDENTE", auditResult: "NEUTRAL", auditColor: "#6c757d" };
    }

    const agora = atual.timestamp;
    let result: ResultadoAuditoria = "RED";
    let message = "";

    if (sinal.type === "PAUSE") {
      result = atual.numero === 0 ? "RED" : "GREEN";
      message = atual.numero === 0
        ? "Padrão de bloqueio falhou: ZERO repetido."
        : "Pausa respeitada / próximo giro colorido.";
    } else if (sinal.categoria === "ab") {
      result = alturaValida(atual.numero, sinal.alvo) ? "GREEN" : "RED";
      message = `Resultado: ${atual.numero} (${atual.numero === 0 ? "ZERO" : classificar(atual.numero).ab})`;
    } else if (sinal.categoria === "duzia") {
      const hitAltura = alturaValida(atual.numero, sinal.auditExpectedHeight);
      const hitCobertura = coberturaValida(atual.numero, sinal.alvo);
      result = hitAltura && hitCobertura ? "GREEN" : hitAltura !== hitCobertura ? "PARTIAL" : "RED";
      message = `Resultado: ${atual.numero} (${classeNumero(atual.numero)})`;
    } else if (sinal.categoria === "secao") {
      const excluida = sinal.auditExcludedSession ?? "";
      const secao = classificar(atual.numero).secao;
      result = atual.numero !== 0 && secao !== excluida ? "GREEN" : "RED";
      message = `Resultado: ${atual.numero} (${secao})`;
    } else if (sinal.categoria === "pi") {
      result = atual.numero === 0 ? "RED" : classificar(atual.numero).pi === sinal.alvo ? "GREEN" : "RED";
      message = `Resultado: ${atual.numero} (${atual.numero === 0 ? "ZERO" : classificar(atual.numero).pi})`;
    } else {
      result = atual.numero === 0 ? "RED" : classificar(atual.numero)[sinal.categoria] === sinal.alvo ? "GREEN" : "RED";
      message = `Resultado: ${atual.numero} (${classeNumero(atual.numero)})`;
    }

    return {
      ...sinal,
      status: result === "GREEN" || result === "PARTIAL" || result === "RED" ? result === "GREEN" || result === "PARTIAL" ? "WIN" : "RED" : "PENDENTE",
      auditResult: result,
      auditColor: result === "GREEN" ? "#28a745" : result === "RED" ? "#dc3545" : result === "PARTIAL" ? "#ffc107" : "#6c757d",
      auditMessage: message,
      auditTimestamp: agora,
      auditSpinId: atual.id,
      auditNumero: atual.numero,
      auditClasse: atual.numero === 0 ? "ZERO" : classeNumero(atual.numero),
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

  const resolvidos = win + red;
  return {
    total: sinais.length,
    win,
    red,
    pendentes,
    cancelados,
    taxaWin: resolvidos ? (win / resolvidos) * 100 : 0,
    taxaRed: resolvidos ? (red / resolvidos) * 100 : 0,
    maiorSeqWin,
    maiorSeqRed,
    ultimo: sinais.length ? sinais[sinais.length - 1]! : null,
  };
}
