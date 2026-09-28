import React, { useEffect, useMemo, useState } from "react";
import { useSinais } from "@/lib/roleta/useSinais";
import { calcularRetornoPosZero, type Sinal } from "@/lib/roleta/engine";
import { useEstado } from "@/lib/roleta/store";

type Perfil = "conservador" | "equilibrado" | "agressivo";
type WalletStatus = "ATIVA" | "ARQUIVADA";
type Tab = "carteiras" | "relatorios" | "simulador";
type Scenario = "OTIMISTA" | "REALISTA" | "REAL";

export interface HistoricoBanca {
  id: number;
  strategy: string;
  stake: number;
  result: number;
  bankAfter: number;
  isWin: boolean;
  signalId?: string;
  regimeClassificado?: "LIMPA" | "HOSTIL";
  motivoHostil?: string;
  gale1Liberado?: boolean;
  gale1Usado?: boolean;
  gale1Resultado?: "GREEN" | "RED" | "n/a";
  desfechoSequencia?: string;
  unidadesLiquidasSequencia?: number;
  recordedAt: number;
}

export interface Carteira {
  id: string;
  nome: string;
  criadaEm: number;
  status: WalletStatus;
  bancaInicial: number;
  bancaReal: number;
  perfil: Perfil;
  stopWin: number;
  stopLoss: number;
  livroRazao: HistoricoBanca[];
  wins: number;
  losses: number;
  diasOperados: number;
  processedSignals: string[];
}

interface PersistenciaBanca {
  version: 2;
  carteiras: Carteira[];
  carteiraAtivaId: string;
}

export interface BancaState {
  bank: number;
  winPct: number;
  lossPct: number;
  odd: number;
  targetEntries: number;
  accumulatedLoss: number;
  profile: Perfil;
  currentBank: number;
  initialBank: number;
  martingaleLevel: 1 | 2;
  history: HistoricoBanca[];
  nextStrategyName: string;
  processedSignals: string[];
}

const STORAGE_KEY = "roleta-banca-v72";
const LEGACY_KEYS = ["rouletteSession", "roleta-gerenciador-banca-v2"] as const;

const PERFIL_PCT: Record<Perfil, number> = {
  conservador: 0.10,
  equilibrado: 0.20,
  agressivo: 0.35,
};

const PERFIL_LABEL: Record<Perfil, string> = {
  conservador: "10%",
  equilibrado: "20%",
  agressivo: "35%",
};

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pct(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
}

function dateKey(ts: number) {
  const d = new Date(ts);
  return d.toISOString().slice(0, 10);
}

function defaultWallet(): Carteira {
  return {
    id: "carteira-" + Date.now(),
    nome: "Carteira Principal",
    criadaEm: Date.now(),
    status: "ATIVA",
    bancaInicial: 100,
    bancaReal: 100,
    perfil: "conservador",
    stopWin: 10,
    stopLoss: 20,
    livroRazao: [],
    wins: 0,
    losses: 0,
    diasOperados: 0,
    processedSignals: [],
  };
}

function normalizeWallet(w: Partial<Carteira>): Carteira {
  return {
    id: w.id ?? "carteira-" + Math.random().toString(36).slice(2),
    nome: w.nome ?? "Carteira",
    criadaEm: w.criadaEm ?? Date.now(),
    status: w.status === "ARQUIVADA" ? "ARQUIVADA" : "ATIVA",
    bancaInicial: Number(w.bancaInicial ?? 100),
    bancaReal: Number(w.bancaReal ?? w.bancaInicial ?? 100),
    perfil: w.perfil ?? "conservador",
    stopWin: Number(w.stopWin ?? 10),
    stopLoss: Number(w.stopLoss ?? 20),
    livroRazao: Array.isArray(w.livroRazao) ? w.livroRazao : [],
    wins: Number(w.wins ?? 0),
    losses: Number(w.losses ?? 0),
    diasOperados: Number(w.diasOperados ?? 0),
    processedSignals: Array.isArray(w.processedSignals) ? w.processedSignals : [],
  };
}

function loadPersistence(): PersistenciaBanca {
  if (typeof window === "undefined") return { version: 2, carteiras: [defaultWallet()], carteiraAtivaId: "" };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<PersistenciaBanca>;
      const carteiras = (saved.carteiras ?? []).map(normalizeWallet);
      const ativas = carteiras.filter((c) => c.status === "ATIVA");
      const active = ativas.find((c) => c.id === saved.carteiraAtivaId) ?? ativas[0];
      if (carteiras.length && active) return { version: 2, carteiras, carteiraAtivaId: active.id };
    }

    for (const key of LEGACY_KEYS) {
      const legacy = window.localStorage.getItem(key);
      if (!legacy) continue;
      const s = JSON.parse(legacy) as Partial<BancaState>;
      const bank = Number(s.currentBank ?? s.bank ?? s.initialBank ?? 100);
      const initial = Number(s.initialBank ?? s.bank ?? 100);
      const history = Array.isArray(s.history) ? s.history : [];
      const migrated = normalizeWallet({
        id: "carteira-migrada",
        nome: "Carteira Migrada",
        bancaInicial: initial,
        bancaReal: bank,
        perfil: s.profile,
        stopWin: s.winPct,
        stopLoss: s.lossPct,
        livroRazao: history,
        wins: history.filter((h) => h.isWin).length,
        losses: history.filter((h) => !h.isWin).length,
        processedSignals: s.processedSignals,
      });
      return { version: 2, carteiras: [migrated], carteiraAtivaId: migrated.id };
    }
  } catch {
    // Recomeça somente se o JSON persistido estiver inválido.
  }
  const wallet = defaultWallet();
  return { version: 2, carteiras: [wallet], carteiraAtivaId: wallet.id };
}

function getSignalStake(wallet: Carteira) {
  const pnl = wallet.bancaReal - wallet.bancaInicial;
  const winLimit = wallet.bancaInicial * (wallet.stopWin / 100);
  const lossLimit = wallet.bancaInicial * (wallet.stopLoss / 100);
  if (pnl >= winLimit || pnl <= -lossLimit || wallet.bancaReal <= 0) return 0;
  const raw = wallet.bancaReal * PERFIL_PCT[wallet.perfil];
  return Math.max(0.5, Math.round(raw * 2) / 2);
}

function terminalOutcome(s: Sinal): "GREEN" | "RED" | null {
  if (s.auditResult === "GREEN") return "GREEN";
  if (s.auditResult === "RED" && ["FALHA_GIRO1", "FALHA_GALE1"].includes(String(s.desfechoSequencia))) return "RED";
  return null;
}

function sequenceUnits(s: Sinal): number {
  if (s.desfechoSequencia === "GREEN_GALE1" || s.desfechoSequencia === "GREEN_DIRETO") return 1;
  if (s.desfechoSequencia === "FALHA_GALE1") return -3;
  if (s.desfechoSequencia === "FALHA_GIRO1") return -1;
  return s.auditResult === "GREEN" ? 1 : s.auditResult === "RED" ? -1 : 0;
}

function applyNewResults(wallet: Carteira, sinais: Sinal[]): Carteira {
  if (wallet.status !== "ATIVA") return wallet;
  let next = { ...wallet, livroRazao: [...wallet.livroRazao], processedSignals: [...wallet.processedSignals] };
  const processed = new Set(next.processedSignals);

  for (const s of sinais) {
    if (s.type !== "ENTRY_SIGNAL" || processed.has(s.id)) continue;
    const outcome = terminalOutcome(s);
    if (!outcome) continue;

    const stake = getSignalStake(next);
    const units = sequenceUnits(s);
    if (!Number.isFinite(stake) || stake <= 0 || units === 0) continue;

    const result = stake * units;
    const bankAfter = next.bancaReal + result;
    const now = Date.now();
    const item: HistoricoBanca = {
      id: next.livroRazao.length + 1,
      strategy: s.title,
      stake,
      result,
      bankAfter,
      isWin: outcome === "GREEN",
      signalId: s.id,
      regimeClassificado: s.regimeClassificado,
      motivoHostil: s.motivoHostil,
      gale1Liberado: s.gale1Liberado,
      gale1Usado: s.gale1Usado,
      gale1Resultado: s.gale1Resultado,
      desfechoSequencia: s.desfechoSequencia,
      unidadesLiquidasSequencia: units,
      recordedAt: now,
    };

    next.bancaReal = bankAfter;
    next.wins += outcome === "GREEN" ? 1 : 0;
    next.losses += outcome === "RED" ? 1 : 0;
    next.processedSignals.push(s.id);
    next.livroRazao.unshift(item);
  }

  next.diasOperados = new Set(next.livroRazao.map((h) => dateKey(h.recordedAt))).size;
  return next;
}

function calculateStats(wallets: Carteira[]) {
  const rows = wallets.flatMap((w) => w.livroRazao);
  const greenDireto = rows.filter((h) => h.desfechoSequencia === "GREEN_DIRETO").length;
  const greenGale1 = rows.filter((h) => h.desfechoSequencia === "GREEN_GALE1").length;
  const falhaGiro1 = rows.filter((h) => h.desfechoSequencia === "FALHA_GIRO1").length;
  const falhaGale = rows.filter((h) => ["FALHA_GALE1", "FALHA_GALE"].includes(String(h.desfechoSequencia))).length;
  const sequencias = greenDireto + greenGale1 + falhaGiro1 + falhaGale;
  const green = greenDireto + greenGale1;
  const redGiro1Limpa = rows.filter((h) => h.regimeClassificado === "LIMPA" && h.desfechoSequencia === "FALHA_GIRO1" && h.gale1Liberado).length;
  const recuperados = greenGale1;
  const ev = sequencias ? rows.reduce((sum, h) => sum + (h.unidadesLiquidasSequencia ?? 0), 0) / sequencias : 0;

  const byStrategy = new Map<string, HistoricoBanca[]>();
  for (const h of rows) {
    const key = h.strategy || "Sem estratégia";
    byStrategy.set(key, [...(byStrategy.get(key) ?? []), h]);
  }

  let running = 0;
  let peak = 0;
  let maxDD = 0;
  let currentDD = 0;
  for (const h of [...rows].sort((a, b) => a.recordedAt - b.recordedAt)) {
    running += h.result;
    peak = Math.max(peak, running);
    currentDD = Math.max(0, peak - running);
    maxDD = Math.max(maxDD, currentDD);
  }
  const days = new Map<string, number>();
  for (const h of rows) days.set(dateKey(h.recordedAt), (days.get(dateKey(h.recordedAt)) ?? 0) + h.result);
  const dayValues = [...days.values()];

  return {
    rows, greenDireto, greenGale1, falhaGiro1, falhaGale, sequencias, green,
    hitRate: sequencias ? (green / sequencias) * 100 : 0,
    ev, redGiro1Limpa, recuperados,
    recoveryRate: redGiro1Limpa ? (recuperados / redGiro1Limpa) * 100 : 0,
    byStrategy,
    maxDD,
    currentDD,
    bestDay: dayValues.length ? Math.max(...dayValues) : 0,
    worstDay: dayValues.length ? Math.min(...dayValues) : 0,
  };
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="rounded-xl border border-border bg-card p-4"><div className="text-[10px] font-black tracking-widest text-muted-foreground">{label}</div><div className="mt-1 text-xl font-black">{value}</div>{hint && <div className="mt-1 text-[10px] text-muted-foreground">{hint}</div>}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-border bg-card p-4"><h3 className="mb-3 text-xs font-black tracking-widest">{title}</h3>{children}</section>;
}

export function updateNextStrategyName(name: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("roleta-next-strategy", name || "Sinal v6.6");
  window.dispatchEvent(new CustomEvent("roleta:strategy", { detail: name || "Sinal v6.6" }));
}

export function registerBancaResult(isWin: boolean) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("roleta:banca-result", { detail: { isWin } }));
}
export function registerBancaGale1() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("roleta:banca-gale1"));
}

export function calculateSmartStake(state: BancaState) {
  const value = state.currentBank * (PERFIL_PCT[state.profile] / 10);
  return Math.max(0.5, Math.round(value * 2) / 2);
}

export function GerenciadorBanca() {
  const { sinais } = useSinais();
  const estadoRoleta = useEstado();
  const [persist, setPersist] = useState<PersistenciaBanca>(() => loadPersistence());
  const [tab, setTab] = useState<Tab>("carteiras");
  const [filtro, setFiltro] = useState<WalletStatus | "TODAS">("ATIVA");
  const [selectedId, setSelectedId] = useState("");
  const [scenario, setScenario] = useState<Scenario>("REALISTA");
  const [simInitial, setSimInitial] = useState(0);
  const [meta, setMeta] = useState(5);
  const [days, setDays] = useState(30);
  const [customMeta, setCustomMeta] = useState("");

  const active = persist.carteiras.find((w) => w.id === persist.carteiraAtivaId) ?? null;

  useEffect(() => {
    if (!persist.carteiraAtivaId && persist.carteiras[0]) {
      setPersist((p) => ({ ...p, carteiraAtivaId: p.carteiras[0]?.id ?? p.carteiraAtivaId }));
    }
  }, [persist.carteiraAtivaId, persist.carteiras]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persist));
  }, [persist]);

  useEffect(() => {
    if (!active) return;
    const updated = applyNewResults(active, sinais);
    if (JSON.stringify(updated) !== JSON.stringify(active)) {
      setPersist((p) => ({ ...p, carteiras: p.carteiras.map((w) => w.id === updated.id ? updated : w) }));
    }
  }, [sinais, active]);

  useEffect(() => {
    if (active && simInitial === 0) setSimInitial(active.bancaReal);
  }, [active, simInitial]);

  const walletsVisible = persist.carteiras.filter((w) => filtro === "TODAS" || w.status === filtro);
  const stats = useMemo(() => calculateStats(persist.carteiras), [persist.carteiras]);
  const retornoPosZero = useMemo(() => calcularRetornoPosZero(estadoRoleta.spins), [estadoRoleta.spins]);
  const ativos = persist.carteiras.filter((w) => w.status === "ATIVA");
  const arquivadas = persist.carteiras.filter((w) => w.status === "ARQUIVADA");
  const saldoConsolidado = ativos.reduce((s, w) => s + w.bancaReal, 0);
  const inicialAtivas = ativos.reduce((s, w) => s + w.bancaInicial, 0);
  const delta = saldoConsolidado - inicialAtivas;
  const deltaPct = inicialAtivas ? (delta / inicialAtivas) * 100 : 0;

  function selectWallet(id: string) {
    const wallet = persist.carteiras.find((w) => w.id === id);
    if (!wallet || wallet.status !== "ATIVA") return;
    setPersist((p) => ({ ...p, carteiraAtivaId: id }));
    setSelectedId(id);
    setSimInitial(wallet.bancaReal);
  }

  function createWallet() {
    const nome = window.prompt("Nome da nova carteira:", "Carteira " + (persist.carteiras.length + 1));
    if (!nome) return;
    const raw = window.prompt("Banca inicial (R$):", "100");
    const initial = Math.max(0, Number((raw ?? "100").replace(",", ".")));
    if (!Number.isFinite(initial) || initial <= 0) return;
    const wallet = normalizeWallet({ id: "carteira-" + Date.now(), nome, bancaInicial: initial, bancaReal: initial });
    setPersist((p) => ({ ...p, carteiras: [...p.carteiras, wallet], carteiraAtivaId: wallet.id }));
    setSelectedId(wallet.id);
  }

  function archiveWallet(id: string) {
    const wallet = persist.carteiras.find((w) => w.id === id);
    if (!wallet || wallet.status !== "ATIVA") return;
    if (window.confirm(`Arquivar "${wallet.nome}"? Ela ficará congelada e preservará o livro-razão.`)) {
      setPersist((p) => {
        const carteiras = p.carteiras.map((w) => w.id === id ? { ...w, status: "ARQUIVADA" as const } : w);
        const nextActive = p.carteiraAtivaId === id ? carteiras.find((w) => w.status === "ATIVA")?.id ?? "" : p.carteiraAtivaId;
        return { ...p, carteiras, carteiraAtivaId: nextActive };
      });
    }
  }

  function restoreWallet(id: string) {
    setPersist((p) => ({ ...p, carteiras: p.carteiras.map((w) => w.id === id ? { ...w, status: "ATIVA" as const } : w) }));
  }

  const sim = useMemo(() => {
    const start = Math.max(0, simInitial || active?.bancaReal || 0);
    const realRows = [...(active?.livroRazao ?? [])].sort((a, b) => a.recordedAt - b.recordedAt);
    const measuredHit = stats.sequencias >= 10 ? stats.hitRate / 100 : 0;
    const ev = stats.sequencias >= 10 ? stats.ev : 0;
    const stakePct = active && start ? (getSignalStake(active) / start) * 100 : 0;
    const metaRate = meta / 100;

    const optimistic: number[] = [];
    const realistic: number[] = [];
    const real: number[] = [];
    let o = start, r = start, rr = start;
    for (let d = 1; d <= days; d++) {
      o *= 1 + metaRate;
      r *= 1 + metaRate * measuredHit;
      optimistic.push(o);
      realistic.push(r);
      if (d <= realRows.length) rr = start + realRows.slice(0, d).reduce((sum, h) => sum + h.result, 0);
      real.push(d <= realRows.length ? rr : NaN);
    }

    const ops = ev > 0 ? Math.ceil(metaRate / ev) : null;
    const sustentabilidade = ops !== null && active ? ops <= Math.max(1, active.livroRazao.length / Math.max(1, active.diasOperados)) : false;

    const selected = scenario === "OTIMISTA" ? optimistic : scenario === "REALISTA" ? realistic : real;
    const final = selected.filter(Number.isFinite).at(-1) ?? start;

    return { start, optimistic, realistic, real, final, accumulated: final - start, multiplier: start ? final / start : 0, dayOne: start * metaRate, measuredHit, ev, stakePct, ops, sustentabilidade };
  }, [active, stats, simInitial, meta, days, scenario]);

  const series = scenario === "OTIMISTA" ? sim.optimistic : scenario === "REALISTA" ? sim.realistic : sim.real;
  const maxSeries = Math.max(sim.start, ...sim.optimistic, ...sim.realistic, ...sim.real.filter(Number.isFinite));
  const minSeries = Math.min(sim.start, ...sim.optimistic, ...sim.realistic, ...sim.real.filter(Number.isFinite));
  const chartW = 760, chartH = 240, pad = 28;
  const point = (arr: number[], i: number) => {
    const denom = Math.max(1, maxSeries - minSeries);
    const x = pad + (i / Math.max(1, days - 1)) * (chartW - pad * 2);
    const y = chartH - pad - (((arr[i] ?? 0) - minSeries) / denom) * (chartH - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };
  const poly = (arr: number[]) => arr.map((v, i) => Number.isFinite(v) ? point(arr, i) : "").filter(Boolean).join(" ");

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-[10px] font-black tracking-[0.2em] text-muted-foreground">BANCA</div><h1 className="text-2xl font-black">Gestão de Banca</h1><p className="text-xs text-muted-foreground">Carteiras isoladas · livro-razão · relatórios · simulador composto</p></div>
          <div className="flex rounded-lg border border-border p-1">
            {(["carteiras","relatorios","simulador"] as Tab[]).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-2 text-xs font-black ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t.toUpperCase()}</button>)}
          </div>
        </div>
      </header>

      {tab === "carteiras" && (
        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><div className="text-[10px] font-black tracking-widest text-muted-foreground">SALDO CONSOLIDADO</div><div className="mt-1 text-3xl font-black">{brl(saldoConsolidado)}</div><div className="text-xs text-muted-foreground">{delta >= 0 ? "+" : ""}{brl(delta)} · {delta >= 0 ? "+" : ""}{pct(deltaPct)} · {ativos.length} carteiras ativas · banca inicial total {brl(inicialAtivas)}</div></div>
              <button onClick={createWallet} className="rounded-lg bg-primary px-4 py-2 text-xs font-black text-primary-foreground">+ NOVA CARTEIRA</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              <Metric label="CARTEIRAS ATIVAS" value={String(ativos.length)} />
              <Metric label="ARQUIVADAS" value={String(arquivadas.length)} />
              <Metric label="WINS" value={String(stats.green)} />
              <Metric label="LOSSES" value={String(stats.rows.length - stats.green)} />
            </div>
          </section>

          <div className="flex gap-2">
            {(["ATIVA","ARQUIVADA","TODAS"] as const).map((f) => <button key={f} onClick={() => setFiltro(f)} className={`rounded-md border px-3 py-1.5 text-[11px] font-black ${filtro === f ? "bg-primary text-primary-foreground" : "border-border"}`}>{f === "ATIVA" ? "ATIVAS" : f === "ARQUIVADA" ? "ARQUIVADAS" : "TODAS"}</button>)}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {walletsVisible.map((w) => {
              const d = w.bancaReal - w.bancaInicial;
              const isSelected = w.id === persist.carteiraAtivaId;
              return <article key={w.id} className={`rounded-xl border p-4 ${isSelected ? "border-primary ring-1 ring-primary" : "border-border"}`}>
                <div className="flex items-start justify-between gap-2"><div><div className="font-black">{w.nome}</div><div className="text-[10px] text-muted-foreground">{new Date(w.criadaEm).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })}</div></div><span className={`rounded-full px-2 py-1 text-[9px] font-black ${w.status === "ATIVA" ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>{w.status}</span></div>
                <div className="mt-4 text-2xl font-black">{brl(w.bancaReal)}</div>
                <div className={`text-xs font-bold ${d >= 0 ? "text-emerald-500" : "text-red-500"}`}>{d >= 0 ? "+" : ""}{brl(d)} · {w.bancaInicial ? pct((d / w.bancaInicial) * 100) : "0%"}</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]"><div><b>{w.wins}</b><div className="text-muted-foreground">W·L</div></div><div><b>{w.losses}</b><div className="text-muted-foreground">LOSSES</div></div><div><b>{w.diasOperados}</b><div className="text-muted-foreground">DIAS</div></div></div>
                <div className="mt-3 flex gap-2">
                  {w.status === "ATIVA" && <button onClick={() => selectWallet(w.id)} className="flex-1 rounded border border-border px-2 py-2 text-[10px] font-black">{isSelected ? "ATIVA · OPERACIONAL" : "SELECIONAR"}</button>}
                  {w.status === "ATIVA" ? <button onClick={() => archiveWallet(w.id)} className="rounded border border-border px-2 py-2 text-[10px] font-bold">ARQUIVAR</button> : <button onClick={() => restoreWallet(w.id)} className="rounded border border-border px-2 py-2 text-[10px] font-bold">REATIVAR</button>}
                </div>
                {isSelected && <div className="mt-3 rounded-lg bg-primary/10 p-2 text-[10px] font-bold">Stake base atual: {brl(getSignalStake(w))} · perfil {w.perfil} ({PERFIL_LABEL[w.perfil]})</div>}
              </article>;
            })}
          </div>
        </div>
      )}

      {tab === "relatorios" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="SEQUÊNCIAS" value={String(stats.sequencias)} />
            <Metric label="GREEN DIRETO" value={String(stats.greenDireto)} />
            <Metric label="GREEN GALE 1" value={String(stats.greenGale1)} />
            <Metric label="FALHAS" value={String(stats.falhaGiro1 + stats.falhaGale)} />
          </div>
          <Section title="ACERTO E EV">
            {stats.sequencias < 10 ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-bold">amostra pequena — ainda não há N=10 sequências para uma taxa confiável.</div> : <div className="grid gap-3 md:grid-cols-3"><Metric label="ACERTO POR SEQUÊNCIA" value={pct(stats.hitRate)} /><Metric label="EV MÉDIO" value={stats.ev.toFixed(3) + " unidades"} /><Metric label="RECUPERAÇÃO GALE" value={stats.redGiro1Limpa ? pct(stats.recoveryRate) : "amostra pequena"} /></div>}
          </Section>
          <Section title="RETORNO-PÓS-ZERO">
            <div className="grid gap-3 md:grid-cols-4">
              <Metric label="ZEROS" value={String(retornoPosZero.totalZeros)} />
              <Metric label="AVALIADOS" value={String(retornoPosZero.avaliados)} />
              <Metric label="MATCHES" value={String(retornoPosZero.matches)} />
              <Metric label="RETORNO-PÓS-ZERO" value={`${retornoPosZero.matches}/${retornoPosZero.avaliados}`} hint={retornoPosZero.avaliados ? pct(retornoPosZero.taxaRetorno) : "aguardando giro depois do ZERO"} />
              <Metric label="CANDIDATO" value={retornoPosZero.candidatoInstalavel ? "AVISAR" : "NÃO"} hint={retornoPosZero.candidatoInstalavel ? "≥10 zeros + ≥70% · não instalar sozinho" : "Meta: N≥10 zeros e retorno ≥70%"} />
            </div>
            <div className="mt-3 max-h-48 overflow-auto text-xs">
              {retornoPosZero.registros.slice(-20).map((r, i) => (
                <div key={r.zeroIndex + "-" + i} className="flex justify-between border-b border-border/50 py-2">
                  <span>ZERO · setor antes: {r.setorAntes ?? "—"} · setor depois: {r.setorDepois ?? "aguardando"}</span>
                  <b>{r.match === null ? "⏳" : r.match ? "MATCH" : "SEM MATCH"}</b>
                </div>
              ))}
              {!retornoPosZero.registros.length && <div className="text-muted-foreground">Nenhum ZERO catalogado nesta sessão.</div>}
            </div>
          </Section>
          <Section title="POR ESTRATÉGIA">
            <div className="overflow-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-border text-[10px] text-muted-foreground"><th className="p-2">ESTRATÉGIA</th><th>AMOSTRA</th><th>ACERTO</th><th>EV</th></tr></thead><tbody>{[...stats.byStrategy.entries()].map(([name, rows]) => { const wins = rows.filter(h => h.isWin).length; const ev = rows.length ? rows.reduce((s,h)=>s+(h.unidadesLiquidasSequencia??0),0)/rows.length : 0; return <tr key={name} className="border-b border-border/50"><td className="p-2 font-bold">{name}</td><td>{rows.length}</td><td>{rows.length < 10 ? "amostra pequena" : pct((wins/rows.length)*100)}</td><td>{rows.length < 10 ? "amostra pequena" : ev.toFixed(3)}</td></tr>; })}</tbody></table></div>
          </Section>
          <Section title="POR REGIME">
            <div className="grid gap-3 md:grid-cols-2">{(["LIMPA","HOSTIL"] as const).map(reg => { const rows=stats.rows.filter(h=>h.regimeClassificado===reg); const wins=rows.filter(h=>h.isWin).length; return <Metric key={reg} label={reg} value={rows.length < 10 ? "amostra pequena" : pct((wins/rows.length)*100)} hint={rows.length + " sequências"} />; })}</div>
          </Section>
          <Section title="RISCO · LIVRO-RAZÃO">
            <div className="grid gap-3 md:grid-cols-4"><Metric label="DRAWDOWN MÁXIMO" value={brl(stats.maxDD)} /><Metric label="DRAWDOWN ATUAL" value={brl(stats.currentDD)} /><Metric label="MELHOR DIA" value={brl(stats.bestDay)} /><Metric label="PIOR DIA" value={brl(stats.worstDay)} /></div>
            <div className="mt-3 max-h-64 overflow-auto text-xs">{stats.rows.slice(0,50).map(h => <div key={h.id + "-" + h.recordedAt} className="flex justify-between border-b border-border/50 py-2"><span>{new Date(h.recordedAt).toLocaleString("pt-BR")} · {h.strategy}</span><b className={h.result >= 0 ? "text-emerald-500" : "text-red-500"}>{h.result >= 0 ? "+" : ""}{brl(h.result)}</b></div>)}</div>
          </Section>
        </div>
      )}

      {tab === "simulador" && (
        <div className="space-y-4">
          <Section title="CENÁRIO">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-xs font-bold">BANCA INICIAL<input value={simInitial} onChange={e=>setSimInitial(Math.max(0, Number(e.target.value.replace(",", "."))))} type="number" min="0" step="0.5" className="mt-1 w-full rounded border border-border bg-background px-3 py-2" /></label>
              <label className="text-xs font-bold">META DIÁRIA %<div className="mt-1 flex flex-wrap gap-1">{[1,2,3,5,7,10].map(v=><button key={v} onClick={()=>setMeta(v)} className={`rounded border px-2 py-1 ${meta===v?"bg-primary text-primary-foreground":"border-border"}`}>{v}%</button>)}<input value={customMeta} onChange={e=>setCustomMeta(e.target.value)} onBlur={()=>{const v=Number(customMeta.replace(",","."));if(v>0)setMeta(v)}} placeholder="custom" className="w-20 rounded border border-border bg-background px-2 py-1" /></div></label>
              <label className="text-xs font-bold">PERÍODO: {days} DIAS<input value={days} onChange={e=>setDays(Math.max(1,Math.min(365,Number(e.target.value)||1)))} type="range" min="1" max="365" className="mt-3 w-full" /></label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">{(["REALISTA","OTIMISTA","REAL"] as Scenario[]).map(s=><button key={s} onClick={()=>setScenario(s)} className={`rounded-lg border px-3 py-2 text-[11px] font-black ${scenario===s?"bg-primary text-primary-foreground":"border-border"}`}>{s}</button>)}</div>
            <div className="mt-2 text-[10px] text-muted-foreground">Exibição padrão: REALISTA. A curva OTIMISTA nunca é apresentada isoladamente.</div>
          </Section>

          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="BANCA FINAL" value={brl(sim.final)} hint={scenario} />
            <Metric label="LUCRO ACUMULADO" value={brl(sim.accumulated)} hint={scenario} />
            <Metric label="MULTIPLICADOR" value={sim.multiplier.toFixed(2) + "x"} hint={scenario} />
            <Metric label="META DO DIA 1" value={brl(sim.dayOne)} hint={meta + "% do cenário"} />
          </div>

          <Section title="CURVA · OTIMISTA / REALISTA / REAL">
            <div className="overflow-x-auto"><svg viewBox={`0 0 ${chartW} ${chartH}`} className="h-64 min-w-[680px] w-full"><polyline fill="none" stroke="currentColor" strokeWidth="2" opacity="0.35" points={poly(sim.optimistic)} /><polyline fill="none" stroke="currentColor" strokeWidth="3" points={poly(sim.realistic)} /><polyline fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="6 4" points={poly(sim.real)} /><text x="32" y="18" fontSize="10">OTIMISTA</text><text x="120" y="18" fontSize="10">REALISTA</text><text x="210" y="18" fontSize="10">REAL</text></svg></div>
            <div className="text-[10px] text-muted-foreground">OTIMISTA = meta todos os dias · REALISTA = meta ponderada pelo acerto real medido · REAL = livro-razão até hoje.</div>
          </Section>

          <Section title="VIABILIDADE">
            {stats.sequencias < 10 ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-bold">meta {meta}%/dia exige dados reais para estimar operações/dia — amostra pequena.</div> : <div className="rounded-lg border border-border bg-background p-3 text-xs"><b>meta {meta}%/dia</b> exige ~{sim.ops ?? "N/A"} ops/dia com EV atual ({stats.hitRate.toFixed(2)}% de acerto, stake {sim.stakePct.toFixed(2)}%). {sim.sustentabilidade ? "Dentro da média histórica observada." : "Aviso: acima do ritmo histórico sustentável ou EV não sustenta a meta."}</div>}
          </Section>

          <Section title={`TABELA DIA-A-DIA · ${scenario}`}>
            <div className="max-h-96 overflow-auto"><table className="w-full text-xs"><thead className="sticky top-0 bg-card"><tr className="border-b border-border text-left text-[10px]"><th className="p-2">DIA</th><th>BANCA</th><th>META</th><th>ACUMULADO</th></tr></thead><tbody>{Array.from({length:days},(_,i)=>{const v=series[i];const b=i===0?sim.start:v;return <tr key={i} className="border-b border-border/40"><td className="p-2">{i+1}</td><td>{b!==undefined&&Number.isFinite(b)?brl(b):"—"}</td><td>{brl(sim.start*Math.pow(1+meta/100,i+1)-sim.start*Math.pow(1+meta/100,i))}</td><td>{b!==undefined&&Number.isFinite(b)?brl(b-sim.start):"—"}</td></tr>})}</tbody></table></div>
          </Section>
        </div>
      )}
    </section>
  );
}

function _legacyUnused() { return React.Fragment; }
