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

export const CANONICAL_RED = new Set<number>([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
export const CANONICAL_BLACK = new Set<number>(Array.from({length:36},(_,i)=>i+1).filter(n=>!CANONICAL_RED.has(n)));
export const CANONICAL_ODD = new Set<number>(Array.from({length:36},(_,i)=>i+1).filter(n=>n%2===1));
export const CANONICAL_EVEN = new Set<number>(Array.from({length:36},(_,i)=>i+1).filter(n=>n%2===0));
export const CANONICAL_HIGH = new Set<number>(Array.from({length:18},(_,i)=>i+19));
export const CANONICAL_LOW = new Set<number>(Array.from({length:18},(_,i)=>i+1));
export const CANONICAL_COLUMNS: Record<string, Set<number>> = { C1:new Set(Array.from({length:12},(_,i)=>i*3+1)), C2:new Set(Array.from({length:12},(_,i)=>i*3+2)), C3:new Set(Array.from({length:12},(_,i)=>i*3+3)) };
export const CANONICAL_DOZENS: Record<string, Set<number>> = { D1:new Set(Array.from({length:12},(_,i)=>i+1)), D2:new Set(Array.from({length:12},(_,i)=>i+13)), D3:new Set(Array.from({length:12},(_,i)=>i+25)) };
export const CANONICAL_SECTORS: Record<string, Set<number>> = {
  TIER:new Set([27,13,36,11,30,8,23,10,5,24,16,33]),
  VOISINS:new Set([22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25]),
  ORFAOS:new Set([17,34,6,1,20,14,31,9]),
  ZERO:new Set([0]),
};

export type AvaliadorResultado = "GREEN" | "RED" | "NO_BET" | "NA" | "INVALID" | "INOPERANTE";
export interface AvaliadorBoot { ok: boolean; errors: string[]; }

function conjuntoCanonico(dimensao: string, valor: string): Set<number> | null {
  const d = dimensao.toUpperCase(); const v = valor.toUpperCase();
  if (d === "PI") return v === "PAR" ? CANONICAL_EVEN : v === "IMPAR" ? CANONICAL_ODD : null;
  if (d === "COR") return v === "VERMELHO" ? CANONICAL_RED : v === "PRETO" ? CANONICAL_BLACK : v === "VERDE" ? new Set([0]) : null;
  if (d === "AB") return v === "ALTO" ? CANONICAL_HIGH : v === "BAIXO" ? CANONICAL_LOW : null;
  if (d === "COLUNA") return CANONICAL_COLUMNS[v] ?? null;
  if (d === "DUZIA") return CANONICAL_DOZENS[v] ?? null;
  if (d === "SECAO") return CANONICAL_SECTORS[v] ?? null;
  return null;
}

export type EntradaNormalizada = {
  dimensao: "COR" | "PARIDADE" | "ALTURA" | "COLUNA" | "DUZIA" | "SECAO" | "CATALOGO";
  valor: string;
  categoria: CategoriaId;
};

export function normalizarEntrada(entradaBruta: string): EntradaNormalizada | null {
  const stringNormalizada = String(entradaBruta ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/^\s*(ENTRAR\\s+EM\\s+|ENTRADA\\s*:\\s*|SINAL\\s*:\\s*|APUESTA\\s*:\\s*|BET\\s*:\\s*)/, "")
    .replace(/\s+/g, " ")
    .trim();

  const mapaExplicito: Record<string, EntradaNormalizada> = {
    VERMELHO: { dimensao: "COR", valor: "VERMELHO", categoria: "cor" },
    PRETO: { dimensao: "COR", valor: "PRETO", categoria: "cor" },
    PAR: { dimensao: "PARIDADE", valor: "PAR", categoria: "pi" },
    IMPAR: { dimensao: "PARIDADE", valor: "IMPAR", categoria: "pi" },
    ALTO: { dimensao: "ALTURA", valor: "ALTO", categoria: "ab" },
    BAIXO: { dimensao: "ALTURA", valor: "BAIXO", categoria: "ab" },
    C1: { dimensao: "COLUNA", valor: "C1", categoria: "coluna" },
    C2: { dimensao: "COLUNA", valor: "C2", categoria: "coluna" },
    C3: { dimensao: "COLUNA", valor: "C3", categoria: "coluna" },
    D1: { dimensao: "DUZIA", valor: "D1", categoria: "duzia" },
    D2: { dimensao: "DUZIA", valor: "D2", categoria: "duzia" },
    D3: { dimensao: "DUZIA", valor: "D3", categoria: "duzia" },
  };

  const resultado = mapaExplicito[stringNormalizada];
  if (resultado) return resultado;

  const catalogo: Array<[string, CategoriaId]> = [
    ["JUNTO", "tipo"], ["SEPARADO", "tipo"], ["TERMINAL", "terminal"], ["CAVALO", "cavalo"],
    ["SECAO", "secao"], ["VIZINHOS 0", "g010"], ["0/10", "g010"],
    ["VIZINHOS 22", "g2234"], ["VIZINHOS 34", "g2234"], ["22/34", "g2234"],
    ["ESPELHO", "g010"], ["LADO", "secao"], ["RUA", "secao"], ["LINHA", "secao"],
  ];
  const catalogoExato = catalogo.find(([label]) => stringNormalizada === label);
  if (catalogoExato) {
    return { dimensao: "CATALOGO", valor: catalogoExato[0], categoria: catalogoExato[1] };
  }
  for (const [prefixo, categoria] of catalogo) {
    if (stringNormalizada.startsWith(prefixo + " ")) {
      return { dimensao: "CATALOGO", valor: stringNormalizada, categoria };
    }
  }

  console.error("NORMALIZADOR REJEITOU:", entradaBruta, "->", stringNormalizada);
  return null;
}

/** Compatibilidade com chamadas anteriores: o formato interno continua categorizado. */
export function normalizarEntradaAvaliador(entrada: string) {
  return normalizarEntrada(entrada);
}

function avaliarCanonico(dimensao: string, valor: string, numero: number, estado: "APOSTA_ATIVA"|"OBSERVACAO" = "APOSTA_ATIVA"): AvaliadorResultado {
  if (numero === 0) return "NO_BET";
  if (estado !== "APOSTA_ATIVA") return "NO_BET";
  const conjunto = conjuntoCanonico(dimensao, valor);
  if (!conjunto || conjunto.size === 0) return "INVALID";
  return conjunto.has(numero) ? "GREEN" : "RED";
}

export function avaliar(dimensao: string, valor: string, numero: number, estado: "APOSTA_ATIVA"|"OBSERVACAO" = "APOSTA_ATIVA"): AvaliadorResultado {
  if (avaliadorBoot.ok === false) return "INOPERANTE";
  if (estado === "OBSERVACAO") return "NA";
  return avaliarCanonico(dimensao, valor, numero, "APOSTA_ATIVA");
}

/** Único ponto de decisão consumido pelo resolver: entrada já normalizada + próximo número. */
export function avaliarEntrada(
  entradaNormalizada: { categoria: string; valor: string } | null,
  numero: number,
  estado: "APOSTA_ATIVA" | "OBSERVACAO" = "APOSTA_ATIVA",
): AvaliadorResultado {
  if (avaliadorBoot.ok === false) return "INOPERANTE";
  if (!entradaNormalizada) return "INVALID";
  if (estado === "OBSERVACAO") return "NA";
  const dimensao = entradaNormalizada.categoria === "pi" ? "PI"
    : entradaNormalizada.categoria === "cor" ? "COR"
    : entradaNormalizada.categoria === "ab" ? "AB"
    : entradaNormalizada.categoria === "coluna" ? "COLUNA"
    : entradaNormalizada.categoria === "duzia" ? "DUZIA"
    : entradaNormalizada.categoria === "secao" ? "SECAO"
    : entradaNormalizada.categoria.toUpperCase();
  const canonicas = ["PI", "COR", "AB", "COLUNA", "DUZIA", "SECAO"];
  if (canonicas.includes(dimensao)) {
    return avaliarCanonico(dimensao, entradaNormalizada.valor, numero, "APOSTA_ATIVA");
  }

  // Dimensões de catálogo continuam sendo resolvidas pela classificação da linha,
  // nunca por um conjunto inventado para a tela.
  if (numero === 0) return "NO_BET";
  const classificacao = classificar(numero) as Record<string, string>;
  const valor = String(entradaNormalizada.valor).toUpperCase();
  const categoria = entradaNormalizada.categoria;
  const atual = classificacao[categoria];
  if (atual === undefined) return "INVALID";
  return String(atual).toUpperCase() === valor ? "GREEN" : "RED";
}

export function autoTestAvaliador(): AvaliadorBoot {
  const errors:string[]=[];
  const guard=(name:string,s:Set<number>|undefined,size:number)=>{ if(!s || s.size!==size) errors.push(name); };
  guard("PAR",CANONICAL_EVEN,18); guard("IMPAR",CANONICAL_ODD,18); guard("VERMELHO",CANONICAL_RED,18); guard("PRETO",CANONICAL_BLACK,18);
  for(const k of ["C1","C2","C3"]) guard(k,CANONICAL_COLUMNS[k],12); for(const k of ["D1","D2","D3"]) guard(k,CANONICAL_DOZENS[k],12);
  guard("VOISINS",CANONICAL_SECTORS["VOISINS"],17); guard("TIER",CANONICAL_SECTORS["TIER"],12); guard("ORFAOS",CANONICAL_SECTORS["ORFAOS"],8);
  const tests:Array<[string,string,number,AvaliadorResultado]>=[
    ["PI","PAR",4,"GREEN"],["PI","PAR",33,"RED"],["PI","IMPAR",33,"GREEN"],["PI","IMPAR",4,"RED"],
    ["COR","VERMELHO",16,"GREEN"],["COR","VERMELHO",28,"RED"],["COR","PRETO",2,"GREEN"],["COR","PRETO",16,"RED"],
    ["AB","ALTO",36,"GREEN"],["AB","ALTO",5,"RED"],["AB","BAIXO",2,"GREEN"],["AB","BAIXO",21,"RED"],
    ["COLUNA","C1",34,"GREEN"],["COLUNA","C1",33,"RED"],["COLUNA","C2",35,"GREEN"],["COLUNA","C2",34,"RED"],["COLUNA","C3",33,"GREEN"],["COLUNA","C3",34,"RED"],
    ["DUZIA","D1",4,"GREEN"],["DUZIA","D1",22,"RED"],["DUZIA","D2",22,"GREEN"],["DUZIA","D2",33,"RED"],["DUZIA","D3",33,"GREEN"],["DUZIA","D3",22,"RED"],
    ["SECAO","TIER",36,"GREEN"],["SECAO","TIER",7,"RED"],["SECAO","VOISINS",7,"GREEN"],["SECAO","VOISINS",36,"RED"],["SECAO","ORFAOS",17,"GREEN"],["SECAO","ORFAOS",7,"RED"],["SECAO","ZERO",0,"NO_BET"]
  ];
  for(const [d,v,n,e] of tests){const got=avaliarCanonico(d,v,n); if(got!==e) errors.push(d+"/"+v+"/"+n+"="+got+" expected "+e);}
  return {ok:errors.length===0,errors};
}

export const avaliadorBoot: AvaliadorBoot = autoTestAvaliador();

const NORMALIZADOR_BOOT_CASES = [
  "ENTRAR EM VERMELHO", "VERMELHO", "PRETO", "PAR", "IMPAR", "ÍMPAR",
  "ALTO", "BAIXO", "C1", "C2", "C3", "D1", "D2", "D3",
] as const;

export function logDiagnosticoNormalizador() {
  if (typeof window === "undefined") return;
  console.log("TESTE NORMALIZADOR:");
  NORMALIZADOR_BOOT_CASES.forEach((str) => {
    console.log(`  "${str}" ->`, normalizarEntrada(str));
  });
}

if (typeof window !== "undefined") {
  logDiagnosticoNormalizador();
}

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
export type ResultadoAuditoria = "GREEN" | "RED" | "PARTIAL" | "AWAITING" | "NO_BET" | "NA" | "INVALID";
export type RegimeClassificado = "LIMPA" | "HOSTIL";
export type MotivoHostil = "ZERO" | "RAJADA" | "SATURACAO" | "MIGRACAO_BR_BT" | "nenhum";

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
  desfechoSequencia: "GREEN_DIRETO" | "GREEN_GALE1" | "FALHA_GIRO1" | "FALHA_GALE1" | "n/a";
  unidadesLiquidasSequencia: 0 | 1 | -1 | -3;
  observacaoHostil: boolean;
  gale1Stake: number;
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
    desfechoSequencia: "n/a",
    unidadesLiquidasSequencia: 0,
    observacaoHostil: false,
    gale1Stake: 0,
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

function classificarRegime(spins: Spin[], bips: MapaBips, index: number) {
  const janela = spins.slice(Math.max(0, index - 14), index);
  const zero = janela.some((s) => s.numero === 0);
  const tipos = janela.map((s) => bips[s.id]).filter(Boolean);
  const rajada = tipos.some((t, i) => i > 0 && t === tipos[i - 1]);
  const saturacao = (key: keyof Pick<Classificacao, "ab" | "cor" | "pi">) => {
    const counts = new Map<string, number>();
    for (const s of janela) {
      const v = s.classificacao[key];
      if (v === "ZERO" || v === "VERDE") continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const max = Math.max(0, ...counts.values());
    return janela.length > 0 && max / janela.length >= 0.70;
  };
  const sat = saturacao("ab") || saturacao("cor") || saturacao("pi");
  const motivo = zero ? "ZERO" : rajada ? "RAJADA" : sat ? "SATURACAO" : "nenhum";
  return { regimeClassificado: motivo === "nenhum" ? "LIMPA" as const : "HOSTIL" as const, motivoHostil: motivo as MotivoHostil };
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
 * é catalogado. Sem próximo giro real, permanece AWAITING.
 */
/** Resolver explícito: o próximo giro existente NUNCA pode permanecer aguardando. */
export function resolverPendentes(sinais: Sinal[], spinsEntrada: Spin[]): Sinal[] {
  return auditarSinais(sinais, spinsEntrada);
}

/** Smoke-test do pipeline real de resolução usado no boot e após cada catálogo. */
export function autoTestResolver(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const cases: Array<[string,string,number,AvaliadorResultado]> = [
    ["COR","VERMELHO",12,"GREEN"], ["COR","VERMELHO",1,"GREEN"],
    ["PI","IMPAR",33,"GREEN"], ["PI","PAR",4,"GREEN"],
    ["AB","ALTO",36,"GREEN"], ["AB","BAIXO",2,"GREEN"],
    ["COR","PRETO",2,"GREEN"], ["COLUNA","C3",33,"GREEN"],
  ];
  for (const [d,v,n,e] of cases) {
    const got = avaliar(d,v,n,"APOSTA_ATIVA");
    if (got !== e) errors.push(`${d}+${n}=${got}, esperado ${e}`);
  }
  const s1 = criarSpin(7, 1000); const s2 = criarSpin(12, 2000);
  const sint = { id:"self-test-resolver", categoria:"cor", categoriaLabel:"COR", alvo:"VERMELHO",
    sequenciaInicial:1, quebra:"", quebraRodadas:0, retorno:"VERMELHO", rodada:1, spinId:s1.id,
    numero:7, timestamp:1000, resultadoSeguinte:null, numeroSeguinte:null, status:"PENDENTE",
    action:"SHOW_POPUP", type:"ENTRY_SIGNAL", colorCode:"#000", title:"SELF", message:"SELF",
    priority:"HIGH", mainAction:"VERMELHO", coverageText:null, sessionPreference:null, excludeText:null,
    footerNote:null, sequenceContext:null, bip:"timer", rodadaAnterior:null, numeroAnterior:null,
    confidence:80, auditResult:"AWAITING", auditColor:"#000", auditMessage:null, auditTimestamp:null,
    auditSpinId:null, auditNumero:null, auditClasse:null, auditExpectedHeight:null, auditExpectedCoverage:[],
    auditTargetRow:1, auditResultPayload:{target_signal_id:"self-test-resolver",previous_bip_row_index:1,current_number:null,
    verdict:"AWAITING",reason:"",ui_update:{row_color:"",badge_text:"",panel_status:""}},
    auditExcludedSession:null, regimeClassificado:"LIMPA", motivoHostil:"nenhum", gale1Liberado:true,
    gale1Usado:false, gale1Resultado:"n/a", desfechoSequencia:"n/a", unidadesLiquidasSequencia:0,
    observacaoHostil:false, gale1Stake:1 } as Sinal;
  const resolved = resolverPendentes([sint], [s1,s2])[0];
  if (!resolved || resolved.auditResult !== "GREEN" || resolved.auditNumero !== 12) errors.push("resolverPendentes não resolveu o próximo giro");

  // T10 do pipeline: o normalizador precisa reconhecer todas as entradas operacionais.
  const aliases = [...NORMALIZADOR_BOOT_CASES];
  for (const raw of aliases) {
    const normalizado = normalizarEntrada(raw);
    if (!normalizado) {
      const limpo = String(raw ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/^\s*(ENTRAR\\s+EM\\s+|ENTRADA\\s*:\\s*|SINAL\\s*:\\s*|APUESTA\\s*:\\s*|BET\\s*:\\s*)/, "")
        .replace(/\\s+/g, " ")
        .trim();
      errors.push(`normalizador rejeitou '${raw}' (normalizado: '${limpo}')`);
    }
  }

  if (typeof window !== "undefined") {
    console.log("SELF-TEST RESULTADO:");
    const selfTestCases: Array<[string, number, AvaliadorResultado]> = [
      ["VERMELHO", 12, "GREEN"], ["VERMELHO", 1, "GREEN"], ["IMPAR", 33, "GREEN"],
      ["PAR", 4, "GREEN"], ["ALTO", 36, "GREEN"], ["BAIXO", 2, "GREEN"],
      ["PRETO", 2, "GREEN"], ["C3", 33, "GREEN"],
      ["VERMELHO", 28, "RED"], ["PAR", 33, "RED"],
    ];
    selfTestCases.forEach(([entrada, numero, esperado], i) => {
      const normalizado = normalizarEntrada(entrada);
      const resultado = avaliarEntrada(normalizado, numero, "APOSTA_ATIVA");
      console.log(`  Caso ${i + 1}: "${entrada}" + ${numero} -> ${resultado} (esperado: ${esperado})`);
    });
  }

  return { ok: errors.length === 0 && avaliadorBoot.ok, errors: [...avaliadorBoot.errors, ...errors] };
}

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
    if (!avaliadorBoot.ok) {
      return { ...sinal, status: "CANCELADO", auditResult: "INVALID", auditColor: "#f59e0b", auditMessage: "⚠️ AVALIADOR INOPERANTE — resultados suspensos, não opere", auditTimestamp: atual.timestamp, auditSpinId: atual.id, auditNumero: null,
        auditResultPayload: { target_signal_id:sinal.id, previous_bip_row_index:sinal.rodada, current_number:null, verdict:"INVALID", reason:"Auto-teste do avaliador falhou: "+avaliadorBoot.errors.join("; "), ui_update:{row_color:"#f59e0b",badge_text:"-",panel_status:"INOPERANTE"} } };
    }
    // OBSERVAÇÃO é definida pelo estado estratégico, nunca pelo valor de gale1Stake.
    // gale1Stake pode ser 0 antes de uma dobra e isso NÃO transforma a entrada ativa em
    // "sem aposta". Só sinais explicitamente rebaixados ficam fora da auditoria.
    if (sinal.observacaoHostil) {
      return { ...sinal, status:"CANCELADO", auditResult:"NA", auditColor:"#6c757d", auditMessage:"n/a — OBSERVAÇÃO / stake 0", auditTimestamp:atual.timestamp, auditSpinId:atual.id, auditNumero:null, auditClasse:classeNumero(atual.numero), auditResultPayload:{target_signal_id:sinal.id,previous_bip_row_index:sinal.rodada,current_number:null,verdict:"NA",reason:"OBSERVAÇÃO/stake 0 não participa da auditoria.",ui_update:{row_color:"#6c757d",badge_text:"n/a",panel_status:"NA"}}};
    }
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

    // Único juiz: toda aposta ativa é resolvida pela função canônica avaliar().
    const entrada = entradaCanonicaDoSinal(sinal);
    if (!entrada) {
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
    const veredito = avaliarEntrada(entrada, atual.numero, "APOSTA_ATIVA");
    if (veredito === "NA") {
      return { ...sinal, status:"CANCELADO", auditResult:"NA", auditColor:"#6c757d", auditMessage:"n/a — OBSERVAÇÃO / stake 0", auditTimestamp:atual.timestamp, auditSpinId:atual.id, auditNumero:null, auditClasse:classeNumero(atual.numero), auditResultPayload:{target_signal_id:sinal.id,previous_bip_row_index:sinal.rodada,current_number:null,verdict:"NA",reason:"OBSERVAÇÃO/stake 0 não participa da auditoria.",ui_update:{row_color:"#6c757d",badge_text:"n/a",panel_status:"NA"}}};
    }
    if (veredito === "INOPERANTE") {
      return { ...sinal, status:"CANCELADO", auditResult:"INVALID", auditColor:"#f59e0b", auditMessage:"⚠️ AVALIADOR INOPERANTE — resultados suspensos, não opere", auditTimestamp:atual.timestamp, auditSpinId:atual.id, auditNumero:null, auditClasse:classeNumero(atual.numero), auditResultPayload:{target_signal_id:sinal.id,previous_bip_row_index:sinal.rodada,current_number:null,verdict:"INVALID",reason:"Auto-teste do avaliador falhou.",ui_update:{row_color:"#f59e0b",badge_text:"-",panel_status:"INOPERANTE"}}};
    }
    if (veredito === "INVALID") {
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
    result = veredito === "GREEN" ? "GREEN" : "RED";
    reason = result === "GREEN"
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
  limiarSat: number;
  isolamentoExigido: number;
}

interface CalibracaoPortaoGale {
  limiarSat: number;
  isolamento: number;
  liberacoes: Array<{ falhou: boolean; at: number }>;
  limpaSemFalha: number;
}

const GALE_CALIBRATION_KEY = "roleta-gale-calibracao-v671";
const GALE_DEFAULTS = { limiarSat: 0.70, isolamento: 0, maxSat: 0.85, maxIsolamento: 4, janela: 14, tetoFalha: 0.40, M: 10 };

function carregarCalibracaoPortao(): CalibracaoPortaoGale {
  if (typeof window === "undefined") return { limiarSat: 0.70, isolamento: 0, liberacoes: [], limpaSemFalha: 0 };
  try {
    const v = JSON.parse(window.localStorage.getItem(GALE_CALIBRATION_KEY) ?? "{}");
    return {
      limiarSat: Math.min(0.85, Math.max(0.70, Number(v.limiarSat) || 0.70)),
      isolamento: Math.min(4, Math.max(0, Number(v.isolamento) || 0)),
      liberacoes: Array.isArray(v.liberacoes) ? v.liberacoes.slice(-10) : [],
      limpaSemFalha: Math.max(0, Number(v.limpaSemFalha) || 0),
    };
  } catch {
    return { limiarSat: 0.70, isolamento: 0, liberacoes: [], limpaSemFalha: 0 };
  }
}

function salvarCalibracaoPortao(v: CalibracaoPortaoGale) {
  if (typeof window !== "undefined") window.localStorage.setItem(GALE_CALIBRATION_KEY, JSON.stringify(v));
}

export function registrarResultadoGale1Calibracao(gale1FoiLiberado: boolean, falhouGale1: boolean) {
  if (!gale1FoiLiberado) return carregarCalibracaoPortao();
  const v = carregarCalibracaoPortao();
  v.liberacoes = [...v.liberacoes, { falhou: falhouGale1, at: Date.now() }].slice(-10);
  if (falhouGale1) v.limpaSemFalha = 0;
  else v.limpaSemFalha += 1;
  const falhas = v.liberacoes.filter((x) => x.falhou).length;
  if (v.liberacoes.length >= 10 && falhas / v.liberacoes.length > 0.40) {
    v.liberacoes = [];
    v.limpaSemFalha = 0;
    v.limiarSat = Math.min(0.85, Number((v.limiarSat + 0.05).toFixed(2)));
    v.isolamento = Math.min(4, v.isolamento + 1);
  } else if (!falhouGale1 && v.limpaSemFalha >= 5) {
    v.limpaSemFalha = 0;
    v.limiarSat = Math.max(0.70, Number((v.limiarSat - 0.05).toFixed(2)));
    v.isolamento = Math.max(0, v.isolamento - 1);
  }
  salvarCalibracaoPortao(v);
  return v;
}

function contarBipsIsolados(spins: Spin[], bips: MapaBips, index: number, janela: number) {
  const inicio = Math.max(0, index - janela + 1);
  let total = 0;
  for (let i = inicio; i <= index; i++) {
    if (!bips[spins[i]!.id]) continue;
    const anterior = i > inicio && !!bips[spins[i - 1]!.id];
    const proximo = i < index && !!bips[spins[i + 1]!.id];
    if (!anterior && !proximo) total += 1;
  }
  return total;
}

export function classificarRegimeJanela(spins: Spin[], bips: MapaBips, index: number, janela = 14, limiarSat = 0.70): PortaoGale {
  const calib = carregarCalibracaoPortao();
  const limiarEfetivo = Math.min(0.85, Math.max(limiarSat, calib.limiarSat));
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
  const saturacao = Object.values(counts).some((count) => count / n >= limiarEfetivo);
  const isolamentoAtual = contarBipsIsolados(spins, bips, index, janela);
  const isolamentoInsuficiente = calib.isolamento > 0 && isolamentoAtual < calib.isolamento;
  const motivoHostil: MotivoHostil = zeroRecente ? "ZERO" : rajada ? "RAJADA" : saturacao || isolamentoInsuficiente ? "SATURACAO" : "nenhum";
  return {
    regimeClassificado: motivoHostil === "nenhum" ? "LIMPA" : "HOSTIL",
    motivoHostil, gale1Liberado: motivoHostil === "nenhum",
    zeroRecente, rajada, saturacao, janela: w.length,
    limiarSat: limiarEfetivo, isolamentoExigido: calib.isolamento,
  };
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
    s.desfechoSequencia = "n/a";
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
    "regime_classificado","motivo_hostil","gale1_librado","gale1_usado","gale1_resultado","desfecho_sequencia","unidades_liquidas_da_sequencia"
  ];
  const rows = sinais
    .filter((s) => s.auditNumero !== null && ["GREEN","RED","PARTIAL"].includes(s.auditResult))
    .map((s) => [
      s.id, s.title, s.mainAction, s.auditNumero ?? "INCOMPLETO",
      s.auditResult === "GREEN" ? "GREEN" : s.auditResult === "RED" ? "RED" : "PARTIAL",
      s.confidence, s.auditTimestamp ?? "",
      s.regimeClassificado, s.motivoHostil, s.gale1Liberado ? "S" : "N", s.gale1Usado ? "S" : "N",
      s.gale1Resultado, s.desfechoSequencia, s.unidadesLiquidasSequencia
    ]);
  return [header, ...rows].map((row) => row.map(esc).join(",")).join("\n");
}
