import { useSyncExternalStore } from "react";
import type { CategoriaId } from "./classificacao";
import { CATEGORIAS } from "./classificacao";
import { criarSpin, type Spin } from "./catalogo";

export type TipoBip = "timer" | "rolando";
export interface Configuracoes { minimo: number; categoriasAtivas: CategoriaId[]; alertasAtivos: boolean; zeroComoProtecao: boolean; }
export interface EstadoApp { spins: Spin[]; config: Configuracoes; bips: Record<string, TipoBip>; pendentes: Record<number, TipoBip>; }

const CHAVE = "roleta-catalogacao-v1";
const CHAVE_ANTIGA = "roleta-macro-memory-v2";
const MAX_TABLE_SPINS = 120;
const inicial: EstadoApp = {
  spins: [],
  config: { minimo: 4, categoriasAtivas: CATEGORIAS.map((c) => c.id), alertasAtivos: false, zeroComoProtecao: true },
  bips: {},
  pendentes: {},
};
let estado: EstadoApp = inicial;
let carregado = false;
const ouvintes = new Set<() => void>();

function limparDadosDeEstrategias() {
  if (typeof window === "undefined") return;
  [
    "roleta-signal-reliability-v1", "roleta-signal-tracking-v1", "roleta-session-finance-v1",
    "roleta-bankroll-equity-v1", "roleta-forensic-session-archive-v1",
  ].forEach((key) => window.localStorage.removeItem(key));
}
function carregar(): EstadoApp {
  if (carregado || typeof window === "undefined") return estado;
  carregado = true;
  try {
    limparDadosDeEstrategias();
    const novo = window.localStorage.getItem(CHAVE);
    if (novo) {
      const raw = JSON.parse(novo) as Partial<EstadoApp>;
      estado = {
        spins: Array.isArray(raw.spins) ? raw.spins.slice(-MAX_TABLE_SPINS) : [],
        config: { ...inicial.config, ...(raw.config ?? {}) },
        bips: raw.bips && typeof raw.bips === "object" ? raw.bips : {},
        pendentes: raw.pendentes && typeof raw.pendentes === "object" ? raw.pendentes : {},
      };
    } else {
      // Migra apenas catalogação e preferências; estados, correções e sinais antigos são descartados.
      const old = window.localStorage.getItem(CHAVE_ANTIGA);
      if (old) {
        const raw = JSON.parse(old) as Partial<EstadoApp>;
        estado = {
          spins: Array.isArray(raw.spins) ? raw.spins.slice(-MAX_TABLE_SPINS) : [],
          config: { ...inicial.config, ...(raw.config ?? {}) },
          bips: raw.bips && typeof raw.bips === "object" ? raw.bips : {},
          pendentes: raw.pendentes && typeof raw.pendentes === "object" ? raw.pendentes : {},
        };
      }
      window.localStorage.setItem(CHAVE, JSON.stringify(estado));
      window.localStorage.removeItem(CHAVE_ANTIGA);
    }
  } catch { estado = inicial; }
  return estado;
}
function salvar() {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch { /* armazenamento indisponível */ }
}
function definir(mut: (e: EstadoApp) => EstadoApp) {
  estado = mut(carregar()); salvar(); ouvintes.forEach((listener) => listener());
}
export function useEstado(): EstadoApp {
  return useSyncExternalStore((cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb); }, () => carregar(), () => inicial);
}
function criarSpinComBip(numero: number, pendentes: Record<number, TipoBip>) {
  const spin = criarSpin(numero); return { spin, tipo: pendentes[numero] };
}
export const acoes = {
  adicionarNumero(numero: number) {
    definir((e) => {
      const { spin, tipo } = criarSpinComBip(numero, e.pendentes);
      const bips = { ...e.bips }; if (tipo) bips[spin.id] = tipo;
      const pendentes = { ...e.pendentes }; if (tipo) delete pendentes[numero];
      const next = { ...e, spins: [...e.spins, spin].slice(-MAX_TABLE_SPINS), bips, pendentes };
      if (typeof window !== "undefined") queueMicrotask(() => window.dispatchEvent(new CustomEvent("roleta:catalogo-atualizado")));
      return next;
    });
  },
  adicionarVarios(numeros: number[]) {
    definir((e) => {
      const bips = { ...e.bips }; const pendentes = { ...e.pendentes };
      const novos = numeros.map((numero) => {
        const { spin, tipo } = criarSpinComBip(numero, pendentes);
        if (tipo) { bips[spin.id] = tipo; delete pendentes[numero]; }
        return spin;
      });
      if (typeof window !== "undefined") queueMicrotask(() => window.dispatchEvent(new CustomEvent("roleta:catalogo-atualizado")));
      return { ...e, spins: [...e.spins, ...novos].slice(-MAX_TABLE_SPINS), bips, pendentes };
    });
  },
  desfazer() { definir((e) => ({ ...e, spins: e.spins.slice(0, -1) })); },
  limpar() { definir((e) => ({ ...e, spins: [], bips: {}, pendentes: {} })); },
  atualizarConfig(patch: Partial<Configuracoes>) { definir((e) => ({ ...e, config: { ...e.config, ...patch } })); },
  marcarBip(spinId: string, tipo: TipoBip | null) {
    definir((e) => { const bips = { ...e.bips }; if (tipo === null) delete bips[spinId]; else bips[spinId] = tipo; return { ...e, bips }; });
  },
  limparBips() { definir((e) => ({ ...e, bips: {}, pendentes: {} })); },
  marcarPendente(numero: number, tipo: TipoBip | null) {
    definir((e) => { const pendentes = { ...e.pendentes }; if (tipo === null) delete pendentes[numero]; else pendentes[numero] = tipo; return { ...e, pendentes }; });
  },
};
