export type Dimensao = "COR" | "PARIDADE" | "ALTURA" | "COLUNA" | "DUZIA";

export interface EntradaMapeada {
  dimensao: Dimensao;
  valor: string;
}

const VERMELHO = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const PRETO = new Set([2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]);
const COL: Record<string, (n: number) => boolean> = {
  C1: (n) => n !== 0 && n % 3 === 1,
  C2: (n) => n !== 0 && n % 3 === 2,
  C3: (n) => n !== 0 && n % 3 === 0,
};
const DUZ: Record<string, (n: number) => boolean> = {
  D1: (n) => n >= 1 && n <= 12,
  D2: (n) => n >= 13 && n <= 24,
  D3: (n) => n >= 25 && n <= 36,
};

export function normalizarEntrada(b: string): string {
  return (b || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(ENTRAR EM|ENTRADA:|SINAL:|APUESTA:|BET:)\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapearEntrada(s: string): EntradaMapeada | null {
  switch (s) {
    case "VERMELHO": return { dimensao: "COR", valor: "VERMELHO" };
    case "PRETO": return { dimensao: "COR", valor: "PRETO" };
    case "PAR": return { dimensao: "PARIDADE", valor: "PAR" };
    case "IMPAR": return { dimensao: "PARIDADE", valor: "IMPAR" };
    case "ALTO": return { dimensao: "ALTURA", valor: "ALTO" };
    case "BAIXO": return { dimensao: "ALTURA", valor: "BAIXO" };
    case "C1":
    case "C2":
    case "C3": return { dimensao: "COLUNA", valor: s };
    case "D1":
    case "D2":
    case "D3": return { dimensao: "DUZIA", valor: s };
    default: return null;
  }
}

export function pertence(m: EntradaMapeada, n: number): boolean {
  switch (m.dimensao) {
    case "COR": return m.valor === "VERMELHO" ? VERMELHO.has(n) : PRETO.has(n);
    case "PARIDADE": return n !== 0 && (m.valor === "PAR" ? n % 2 === 0 : n % 2 === 1);
    case "ALTURA": return m.valor === "ALTO" ? n >= 19 && n <= 36 : n >= 1 && n <= 18;
    case "COLUNA": return COL[m.valor]?.(n) ?? false;
    case "DUZIA": return DUZ[m.valor]?.(n) ?? false;
  }
}

export function avaliarEntrada(bruta: string, numero: number): "GREEN" | "RED" | null {
  const m = mapearEntrada(normalizarEntrada(bruta));
  if (!m || numero === 0) return null;
  return pertence(m, numero) ? "GREEN" : "RED";
}

export const SELF_TEST = [
  { e: "ENTRAR EM VERMELHO", n: 12, esp: "GREEN" },
  { e: "VERMELHO", n: 1, esp: "GREEN" },
  { e: "ENTRAR EM IMPAR", n: 33, esp: "GREEN" },
  { e: "ÍMPAR", n: 33, esp: "GREEN" },
  { e: "ENTRAR EM PAR", n: 4, esp: "GREEN" },
  { e: "ENTRAR EM ALTO", n: 36, esp: "GREEN" },
  { e: "ENTRAR EM BAIXO", n: 2, esp: "GREEN" },
  { e: "PRETO", n: 2, esp: "GREEN" },
  { e: "C3", n: 33, esp: "GREEN" },
  { e: "D2", n: 22, esp: "GREEN" },
  { e: "ENTRAR EM VERMELHO", n: 28, esp: "RED" },
  { e: "ENTRAR EM PAR", n: 33, esp: "RED" },
] as const;

export function rodarSelfTest() {
  const falhas: string[] = [];
  SELF_TEST.forEach((c, i) => {
    const r = avaliarEntrada(c.e, c.n);
    if (r !== c.esp) falhas.push(`caso ${i + 1}: "${c.e}"+${c.n}->${r}`);
  });
  return { ok: falhas.length === 0, total: SELF_TEST.length, falhas };
}
