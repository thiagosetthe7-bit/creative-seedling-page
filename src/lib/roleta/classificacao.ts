/**
 * Tabelas de classificação extraídas da planilha de referência (aba CATALOGAÇÃO).
 * Toda regra fica centralizada aqui: para alterar uma classificação,
 * edite apenas este arquivo.
 */

export const VERMELHOS = [
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
] as const;

/** SEÇÃO (Zero / VOISINS / ORFÃO / TIER) — índice = número 0..36 */
const SECAO: string[] = [
  "Zero", "ORFÃO", "VOISINS", "ZERO", "VOISINS", "TIER", "ORFÃO", "VOISINS",
  "TIER", "ORFÃO", "TIER", "TIER", "ZERO", "TIER", "ORFÃO", "ZERO", "TIER",
  "ORFÃO", "VOISINS", "VOISINS", "ORFÃO", "VOISINS", "VOISINS", "TIER", "TIER",
  "VOISINS", "ZERO", "TIER", "VOISINS", "VOISINS", "TIER", "ORFÃO", "ZERO",
  "TIER", "ORFÃO", "ZERO", "TIER",
];

/** TIPO (JUNTO / SEPARADO) — índice = número 0..36 */
const TIPO: string[] = [
  "ZERO", "SEPARADO", "SEPARADO", "SEPARADO", "SEPARADO", "SEPARADO",
  "SEPARADO", "SEPARADO", "JUNTO", "JUNTO", "JUNTO", "JUNTO", "JUNTO", "JUNTO",
  "SEPARADO", "SEPARADO", "JUNTO", "JUNTO", "JUNTO", "JUNTO", "JUNTO", "JUNTO",
  "SEPARADO", "SEPARADO", "SEPARADO", "SEPARADO", "JUNTO", "JUNTO", "JUNTO",
  "JUNTO", "JUNTO", "JUNTO", "SEPARADO", "SEPARADO", "SEPARADO", "SEPARADO",
  "SEPARADO",
];

/** 0/10 — 9 VIZINHOS 0 / 9 VIZINHOS 10 */
const G_0_10: string[] = [
  "9 VIZINHOS 0", "9 VIZINHOS 10", "9 VIZINHOS 0", "9 VIZINHOS 0",
  "9 VIZINHOS 0", "9 VIZINHOS 10", "9 VIZINHOS 10", "9 VIZINHOS 0",
  "9 VIZINHOS 10", "9 VIZINHOS 10", "9 VIZINHOS 10", "9 VIZINHOS 10",
  "9 VIZINHOS 0", "9 VIZINHOS 10", "9 VIZINHOS 10", "9 VIZINHOS 0",
  "9 VIZINHOS 10", "9 VIZINHOS 0", "9 VIZINHOS 0", "9 VIZINHOS 0",
  "9 VIZINHOS 10", "9 VIZINHOS 0", "9 VIZINHOS 0", "9 VIZINHOS 10",
  "9 VIZINHOS 10", "9 VIZINHOS 0", "9 VIZINHOS 0", "9 VIZINHOS 10",
  "9 VIZINHOS 0", "9 VIZINHOS 0", "9 VIZINHOS 10", "9 VIZINHOS 10",
  "9 VIZINHOS 0", "9 VIZINHOS 10", "9 VIZINHOS 0", "9 VIZINHOS 0",
  "9 VIZINHOS 10",
];

/** 22/34 — 9 VIZINHOS 22 / 9 VIZINHOS 34 */
const G_22_34: string[] = [
  "ZERO", "9 VIZINHOS 22", "9 VIZINHOS 34", "9 VIZINHOS 22", "9 VIZINHOS 34",
  "9 VIZINHOS 22", "9 VIZINHOS 34", "9 VIZINHOS 22", "9 VIZINHOS 34",
  "9 VIZINHOS 22", "9 VIZINHOS 34", "9 VIZINHOS 34", "9 VIZINHOS 22",
  "9 VIZINHOS 34", "9 VIZINHOS 22", "9 VIZINHOS 34", "9 VIZINHOS 22",
  "9 VIZINHOS 34", "9 VIZINHOS 22", "9 VIZINHOS 34", "9 VIZINHOS 22",
  "9 VIZINHOS 34", "9 VIZINHOS 22", "9 VIZINHOS 34", "9 VIZINHOS 22",
  "9 VIZINHOS 34", "9 VIZINHOS 22", "9 VIZINHOS 34", "9 VIZINHOS 22",
  "9 VIZINHOS 22", "9 VIZINHOS 34", "9 VIZINHOS 22", "9 VIZINHOS 34",
  "9 VIZINHOS 22", "9 VIZINHOS 34", "9 VIZINHOS 22", "9 VIZINHOS 34",
];

/** CAVALO — grupo do último dígito, conforme a planilha */
function cavaloDoTerminal(terminal: number): string {
  if (terminal === 1 || terminal === 4 || terminal === 7) return "1-4-7";
  if (terminal === 2 || terminal === 5 || terminal === 8) return "2-5-8";
  return "0-3-6-9";
}

export interface Classificacao {
  terminal: string;
  cavalo: string;
  ab: string;
  duzia: string;
  coluna: string;
  pi: string;
  tipo: string;
  secao: string;
  g010: string;
  g2234: string;
  cor: string;
}

export function classificar(numero: number): Classificacao {
  const n = numero;
  const zero = n === 0;
  const terminal = n % 10;

  return {
    terminal: `TERM ${terminal}`,
    cavalo: zero ? "ZERO" : cavaloDoTerminal(terminal),
    ab: zero ? "ZERO" : n <= 18 ? "BAIXO" : "ALTO",
    duzia: zero ? "ZERO" : n <= 12 ? "D1" : n <= 24 ? "D2" : "D3",
    coluna: zero ? "ZERO" : `C${((n - 1) % 3) + 1}`,
    pi: zero ? "ZERO" : n % 2 === 0 ? "PAR" : "IMPAR",
    tipo: TIPO[n]!,
    secao: SECAO[n]!,
    g010: G_0_10[n]!,
    g2234: G_22_34[n]!,
    cor: zero ? "VERDE" : (VERMELHOS as readonly number[]).includes(n) ? "VERMELHO" : "PRETO",
  };
}

export function corDoNumero(n: number): "verde" | "vermelho" | "preto" {
  if (n === 0) return "verde";
  return (VERMELHOS as readonly number[]).includes(n) ? "vermelho" : "preto";
}

export type CategoriaId = keyof Classificacao;

export interface CategoriaDef {
  id: CategoriaId;
  label: string;
  /** Categorias em que o valor "ZERO"/"Zero" é neutro e não conta como elemento */
  neutros?: string[];
}

/** Categorias monitoradas — adicionar/remover aqui reflete em toda a aplicação. */
export const CATEGORIAS: CategoriaDef[] = [
  { id: "terminal", label: "TERMINAL" },
  { id: "cavalo", label: "CAVALO", neutros: ["ZERO"] },
  { id: "ab", label: "A/B", neutros: ["ZERO"] },
  { id: "duzia", label: "DÚZIA", neutros: ["ZERO"] },
  { id: "coluna", label: "COLUNA", neutros: ["ZERO"] },
  { id: "pi", label: "P/I", neutros: ["ZERO"] },
  { id: "tipo", label: "TIPO", neutros: ["ZERO"] },
  { id: "secao", label: "SEÇÃO" },
  { id: "g010", label: "0/10" },
  { id: "g2234", label: "22/34", neutros: ["ZERO"] },
  { id: "cor", label: "COR", neutros: ["VERDE"] },
];

export const CATEGORIA_POR_ID = new Map(CATEGORIAS.map((c) => [c.id, c]));
