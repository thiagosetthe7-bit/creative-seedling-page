/**
 * Paleta visual copiada da planilha de referência (aba CATALOGAÇÃO).
 * Apenas apresentação: nenhuma regra de classificação depende deste arquivo.
 */

import type { CategoriaId } from "./classificacao";

export interface Estilo {
  bg: string;
  fg: string;
}

const P = (bg: string, fg = "#000000"): Estilo => ({ bg, fg });

const TERMINAL: Record<string, Estilo> = {
  "TERM 0": P("#7CC576"),
  "TERM 1": P("#FFFFFF"),
  "TERM 2": P("#548235", "#FFFFFF"),
  "TERM 3": P("#A9D18E"),
  "TERM 4": P("#FFFFFF"),
  "TERM 5": P("#8497B0", "#FFFFFF"),
  "TERM 6": P("#2E5C8A", "#FFFFFF"),
  "TERM 7": P("#FFFF00"),
  "TERM 8": P("#FFFF00"),
  "TERM 9": P("#D9E1F2"),
};

const CAVALO: Record<string, Estilo> = {
  "1-4-7": P("#F4B6C2"),
  "2-5-8": P("#FFD966"),
  "0-3-6-9": P("#A9D18E"),
  ZERO: P("#FFFFFF"),
};

const AB: Record<string, Estilo> = {
  BAIXO: P("#E8CFA9"),
  ALTO: P("#ED9B33"),
  ZERO: P("#FFFFFF"),
};

const DUZIA: Record<string, Estilo> = {
  D1: P("#E8CFA9"),
  D2: P("#C79A45"),
  D3: P("#9C6B2E", "#FFFFFF"),
  ZERO: P("#FFFFFF"),
};

const COLUNA: Record<string, Estilo> = {
  C1: P("#EDD9BE"),
  C2: P("#C9A063"),
  C3: P("#A9762E", "#FFFFFF"),
  ZERO: P("#FFFFFF"),
};

const PI: Record<string, Estilo> = {
  PAR: P("#FFFFCC"),
  IMPAR: P("#C7C240"),
  ZERO: P("#FFFFFF"),
};

const TIPO: Record<string, Estilo> = {
  SEPARADO: P("#D9D9D9"),
  JUNTO: P("#A6A6A6"),
  ZERO: P("#FFFFFF"),
};

const SECAO: Record<string, Estilo> = {
  VOISINS: P("#E2D3F5"),
  TIER: P("#B69AE8"),
  "ORFÃO": P("#C9B0EF"),
  ZERO: P("#FFFFFF"),
  Zero: P("#FFFFFF"),
};

const G010: Record<string, Estilo> = {
  "9 VIZINHOS 0": P("#00A050", "#FFFFFF"),
  "9 VIZINHOS 10": P("#9B6FD1", "#FFFFFF"),
};

const G2234: Record<string, Estilo> = {
  "9 VIZINHOS 22": P("#2196F3", "#FFFFFF"),
  "9 VIZINHOS 34": P("#A8CFF0"),
  ZERO: P("#FFFFFF"),
};

const COR: Record<string, Estilo> = {
  VERMELHO: P("#E03131", "#FFFFFF"),
  PRETO: P("#111111", "#FFFFFF"),
  VERDE: P("#0E8A45", "#FFFFFF"),
};

const MAPAS: Partial<Record<CategoriaId, Record<string, Estilo>>> = {
  terminal: TERMINAL,
  cavalo: CAVALO,
  ab: AB,
  duzia: DUZIA,
  coluna: COLUNA,
  pi: PI,
  tipo: TIPO,
  secao: SECAO,
  g010: G010,
  g2234: G2234,
  cor: COR,
};

const NEUTRO: Estilo = P("#FFFFFF", "#111111");

export function estiloCelula(categoria: CategoriaId, valor: string): Estilo {
  return MAPAS[categoria]?.[valor] ?? NEUTRO;
}
