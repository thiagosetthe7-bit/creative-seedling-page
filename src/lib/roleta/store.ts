import { useSyncExternalStore } from "react";
import type { CategoriaId } from "./classificacao";
import { CATEGORIAS } from "./classificacao";
import { criarSpin, type Spin } from "./engine";

export interface Configuracoes {
  minimo: number;
  categoriasAtivas: CategoriaId[];
  alertasAtivos: boolean;
}

export interface EstadoApp {
  spins: Spin[];
  config: Configuracoes;
  /** sinais confirmados manualmente pelo usuário (ids) */
  confirmados: string[];
  /** sinais cancelados manualmente (ids) */
  cancelados: string[];
  /** sinais já exibidos em pop-up (evita reabrir) */
  vistos: string[];
  banca: { inicial: number; unidade: number };
  /** marcações manuais por número: "timer" (BIP NO TIMER) ou "rolando" (BIP ROLANDO) */
  bips: Record<number, "timer" | "rolando">;
}

const CHAVE = "roleta-catalogacao-v1";

const inicial: EstadoApp = {
  spins: [],
  config: {
    minimo: 4,
    categoriasAtivas: CATEGORIAS.map((c) => c.id),
    alertasAtivos: true,
  },
  confirmados: [],
  cancelados: [],
  vistos: [],
  banca: { inicial: 1000, unidade: 10 },
  bips: {},
};

let estado: EstadoApp = inicial;
let carregado = false;
const ouvintes = new Set<() => void>();

function carregar(): EstadoApp {
  if (carregado || typeof window === "undefined") return estado;
  carregado = true;
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (bruto) estado = { ...inicial, ...(JSON.parse(bruto) as EstadoApp) };
  } catch {
    /* ignora dados corrompidos */
  }
  return estado;
}

function salvar() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch {
    /* storage indisponível */
  }
}

function definir(mut: (e: EstadoApp) => EstadoApp) {
  estado = mut(carregar());
  salvar();
  ouvintes.forEach((o) => o());
}

export function useEstado(): EstadoApp {
  return useSyncExternalStore(
    (cb) => {
      ouvintes.add(cb);
      return () => ouvintes.delete(cb);
    },
    () => carregar(),
    () => inicial,
  );
}

export const acoes = {
  adicionarNumero(numero: number) {
    definir((e) => ({ ...e, spins: [...e.spins, criarSpin(numero)] }));
  },
  adicionarVarios(numeros: number[]) {
    definir((e) => ({
      ...e,
      spins: [...e.spins, ...numeros.map((n) => criarSpin(n))],
    }));
  },
  desfazer() {
    definir((e) => ({ ...e, spins: e.spins.slice(0, -1) }));
  },
  limpar() {
    definir((e) => ({ ...e, spins: [], confirmados: [], cancelados: [], vistos: [] }));
  },
  marcarVisto(id: string) {
    definir((e) => (e.vistos.includes(id) ? e : { ...e, vistos: [...e.vistos, id] }));
  },
  confirmar(id: string) {
    definir((e) => ({
      ...e,
      confirmados: e.confirmados.includes(id) ? e.confirmados : [...e.confirmados, id],
      vistos: e.vistos.includes(id) ? e.vistos : [...e.vistos, id],
    }));
  },
  cancelar(id: string) {
    definir((e) => ({
      ...e,
      cancelados: e.cancelados.includes(id) ? e.cancelados : [...e.cancelados, id],
    }));
  },
  atualizarConfig(patch: Partial<Configuracoes>) {
    definir((e) => ({ ...e, config: { ...e.config, ...patch } }));
  },
  atualizarBanca(patch: Partial<EstadoApp["banca"]>) {
    definir((e) => ({ ...e, banca: { ...e.banca, ...patch } }));
  },
  marcarBip(numero: number, tipo: "timer" | "rolando" | null) {
    definir((e) => {
      const bips = { ...e.bips };
      if (tipo === null) delete bips[numero];
      else bips[numero] = tipo;
      return { ...e, bips };
    });
  },
  limparBips() {
    definir((e) => ({ ...e, bips: {} }));
  },
};
