import { useSyncExternalStore } from "react";
import type { CategoriaId } from "./classificacao";
import { CATEGORIAS } from "./classificacao";
import { criarSpin, type Spin } from "./engine";

export type TipoBip = "timer" | "rolando";
export type StatusAuditoriaPersistente = "AGUARDANDO_RESULTADO" | "GREEN" | "RED" | "PARTIAL" | "DADO_PERDIDO";

export interface Configuracoes {
  minimo: number;
  categoriasAtivas: CategoriaId[];
  alertasAtivos: boolean;
}

export interface RegistroAuditoria {
  signalId: string;
  strategy: string;
  entry: string;
  result: number;
  outcome: "GREEN" | "RED" | "PARTIAL" | "DADO_PERDIDO";
  status: StatusAuditoriaPersistente;
  resultTimestamp?: number;
  recordedAt: number;
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
  /**
   * Marcações de bip por RODADA (chave = spin.id).
   * Cada registro catalogado tem seu próprio BT/BR, mesmo que o número se repita.
   */
  bips: Record<string, TipoBip>;
  /**
   * Marcações pendentes por NÚMERO na grade de entrada:
   * aplicam-se à PRÓXIMA rodada catalogada com aquele número e então são consumidas.
   */
  pendentes: Record<number, TipoBip>;
  /** Resultado já registrado; uma vez gravado, o veredito não volta a PENDENTE. */
  auditoriaLog: Record<string, RegistroAuditoria>;
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
  pendentes: {},
  auditoriaLog: {},
};

let estado: EstadoApp = inicial;
let carregado = false;
const ouvintes = new Set<() => void>();

function migrar(bruto: EstadoApp): EstadoApp {
  // Formato antigo: bips indexado por NÚMERO (marcas compartilhadas entre rodadas).
  // Converte para o formato novo aplicando cada marca à rodada mais recente
  // daquele número; marcas sem rodada correspondente viram pendências.
  const antigo = bruto.bips as unknown;
  if (!antigo || typeof antigo !== "object") return bruto;
  const chaves = Object.keys(antigo as Record<string, unknown>);
  const pareceNovo = chaves.every((k) => Number.isNaN(Number(k)));
  if (pareceNovo) return bruto;

  const bips: Record<string, TipoBip> = {};
  const pendentes: Record<number, TipoBip> = {};
  for (const k of chaves) {
    const tipo = (antigo as Record<string, TipoBip>)[k];
    if (tipo !== "timer" && tipo !== "rolando") continue;
    const numero = Number(k);
    const alvo = [...bruto.spins].reverse().find((s) => s.numero === numero);
    if (alvo) bips[alvo.id] = tipo;
    else pendentes[numero] = tipo;
  }
  return { ...bruto, bips, pendentes };
}

function carregar(): EstadoApp {
  if (carregado || typeof window === "undefined") return estado;
  carregado = true;
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (bruto) estado = migrar({ ...inicial, ...(JSON.parse(bruto) as EstadoApp) });
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

/** Cria um spin aplicando (e consumindo) a marcação pendente do número, se houver. */
function criarSpinComBip(numero: number, pendentes: Record<number, TipoBip>) {
  const spin = criarSpin(numero);
  const tipo = pendentes[numero];
  return { spin, tipo };
}

export const acoes = {
  adicionarNumero(numero: number) {
    definir((e) => {
      const { spin, tipo } = criarSpinComBip(numero, e.pendentes);
      const bips = { ...e.bips };
      if (tipo) bips[spin.id] = tipo;
      const pendentes = { ...e.pendentes };
      if (tipo) delete pendentes[numero];
      return { ...e, spins: [...e.spins, spin], bips, pendentes };
    });
  },
  adicionarVarios(numeros: number[]) {
    definir((e) => {
      const bips = { ...e.bips };
      const pendentes = { ...e.pendentes };
      const novos = numeros.map((n) => {
        const { spin, tipo } = criarSpinComBip(n, pendentes);
        if (tipo) {
          bips[spin.id] = tipo;
          delete pendentes[n];
        }
        return spin;
      });
      return { ...e, spins: [...e.spins, ...novos], bips, pendentes };
    });
  },
  desfazer() {
    definir((e) => ({ ...e, spins: e.spins.slice(0, -1) }));
  },
  limpar() {
    definir((e) => ({
      ...e,
      spins: [],
      confirmados: [],
      cancelados: [],
      vistos: [],
      bips: {},
      pendentes: {},
      auditoriaLog: {},
    }));
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
  /** Marca/desmarca o bip de uma rodada específica (individual por registro). */
  marcarBip(spinId: string, tipo: TipoBip | null) {
    definir((e) => {
      const bips = { ...e.bips };
      if (tipo === null) delete bips[spinId];
      else bips[spinId] = tipo;
      return { ...e, bips };
    });
  },
  limparBips() {
    definir((e) => ({ ...e, bips: {}, pendentes: {} }));
  },
  /** Marca/desmarca a pendência de um número na grade (vale para a próxima catalogação). */
  registrarAuditorias(registros: RegistroAuditoria[]) {
    definir((e) => {
      const auditoriaLog = { ...e.auditoriaLog };
      let alterou = false;
      for (const registro of registros) {
        if (!auditoriaLog[registro.signalId]) {
          auditoriaLog[registro.signalId] = { ...registro, status: registro.status ?? registro.outcome };
          alterou = true;
        }
      }
      return alterou ? { ...e, auditoriaLog } : e;
    });
  },
  registrarResultadoManual(signalId: string, outcome: "GREEN" | "RED" | "PARTIAL", result: number) {
    definir((e) => {
      const atual = e.auditoriaLog[signalId];
      if (atual && atual.status !== "AGUARDANDO_RESULTADO") return e;
      return { ...e, auditoriaLog: { ...e.auditoriaLog, [signalId]: { signalId, strategy: atual?.strategy ?? "Resultado manual", entry: atual?.entry ?? "", result, outcome, status: outcome, recordedAt: atual?.recordedAt ?? Date.now(), resultTimestamp: Date.now() } } };
    });
  },
  limparAuditoria() {
    definir((e) => ({ ...e, auditoriaLog: {} }));
  },
  marcarPendente(numero: number, tipo: TipoBip | null) {
    definir((e) => {
      const pendentes = { ...e.pendentes };
      if (tipo === null) delete pendentes[numero];
      else pendentes[numero] = tipo;
      return { ...e, pendentes };
    });
  },
};
