import { useEffect, useState } from "react";
import type { TrackedSignal } from "@/lib/roleta/signalTracking";
import { carregarConfigBanca, dinheiro } from "@/lib/roleta/bankroll";
import { impactoFinanceiro } from "@/lib/roleta/sessionFinance";
import { effectiveSignalResult, loadSessionFinance, saveSessionFinance, SESSION_FINANCE_EVENT, type EditableSignalResult, type SessionFinanceLedger } from "@/lib/roleta/sessionFinance";
import { syncReliabilityHistory } from "@/lib/roleta/signalReliability";

interface SignalTrackingPanelProps { signals: TrackedSignal[]; }
const resultLabel: Partial<Record<EditableSignalResult, string>> = { PENDING: "Pendente", GREEN_R1: "Green R1", GREEN_GALE1: "Green Gale 1", RED: "Red", GALE_BLOCKED: "Gale Bloqueado", NOT_PICKED: "Não Peguei", NO_SIGNAL: "Pendente" };

export function SignalTrackingPanel({ signals }: SignalTrackingPanelProps) {
  const [ledger, setLedger] = useState<SessionFinanceLedger>(() => loadSessionFinance());
  useEffect(() => {
    const sync = () => setLedger(loadSessionFinance());
    window.addEventListener(SESSION_FINANCE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(SESSION_FINANCE_EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  useEffect(() => { syncReliabilityHistory(signals, ledger); }, [signals, ledger]);
  const allSignals = [...(ledger.archivedSignals ?? []), ...signals];
  const visible = [...new Map(allSignals.map((signal) => [signal.id, signal])).values()].filter((signal) => !ledger.removedSignalIds.includes(signal.id));
  const active = visible.filter((s) => s.status !== "CONCLUÍDO" && !s.preCatalog).slice().reverse();
  const updateLedger = (next: SessionFinanceLedger) => { setLedger(next); saveSessionFinance(next); };
  const correct = (id: string, result: EditableSignalResult) => updateLedger({ ...ledger, corrections: { ...ledger.corrections, [id]: result } });
  const remove = (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("Remover esta entrada do histórico e excluir seu impacto financeiro?")) return;
    updateLedger({ ...ledger, removedSignalIds: [...new Set([...ledger.removedSignalIds, id])] });
  };
  const history = visible.slice().reverse();
  const bankroll = carregarConfigBanca();
  const metrics = visible.map((signal) => {
    const result = effectiveSignalResult(signal, ledger);
    const calculated = impactoFinanceiro(signal, bankroll, ledger);
    const impact = result === "NOT_PICKED" ? 0 : ledger.financialOverrides?.[signal.id] !== undefined
      ? ledger.financialOverrides[signal.id]!
      : calculated;
    return { result, impact };
  });
  const greens = metrics.filter(({ result }) => ["GREEN_R1", "GREEN_GALE1", "GREEN_GALE2"].includes(result)).length;
  const reds = metrics.filter(({ result }) => result === "RED").length;
  const resolved = greens + reds;
  const winRate = resolved ? (greens / resolved) * 100 : 0;
  const totalImpact = metrics.reduce((sum, item) => sum + (item.impact ?? 0), 0);
  const money = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${dinheiro(Math.abs(value))}`;
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label="Histórico de sinais da catalogação">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-black tracking-widest">HISTÓRICO DE ENTRADAS DA SESSÃO</h2>
        <div className="flex flex-wrap gap-2" aria-label="Métricas da sessão">
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-300">GREENS {greens}</span>
          <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-xs font-black text-rose-300">REDS {reds}</span>
          <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-xs font-black text-sky-200">WIN RATE {winRate.toFixed(1)}%</span>
          <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${totalImpact > 0 ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : totalImpact < 0 ? "border-rose-400/30 bg-rose-400/10 text-rose-300" : "border-slate-400/30 bg-slate-400/10 text-slate-200"}`}>IMPACTO {money(totalImpact)}</span>
        </div>
      </div>
      {active.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhum sinal aguardando resolução. Os sinais detectados permanecerão no histórico.</p> : active.map((signal) => (
        <article key={signal.id} className="rounded-lg border border-amber-400/40 bg-amber-400/5 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-black">{signal.strategyLabel}</h3><span className={signal.status === "GALE 1 EM ANDAMENTO" ? "rounded-full bg-orange-500/15 px-3 py-1 text-xs font-black text-orange-400" : signal.status === "GALE 1 BLOQUEADO" ? "rounded-full bg-rose-500/20 px-3 py-1 text-xs font-black text-rose-300" : "rounded-full bg-sky-500/15 px-3 py-1 text-xs font-black text-sky-400"}>{signal.status}</span></div>
          <p className="mt-2 text-sm font-bold">{signal.target}</p>{signal.status === "GALE 1 BLOQUEADO" ? <p className="mt-2 rounded-lg border border-rose-400/40 bg-rose-500/10 p-3 text-sm font-bold text-rose-200">🚫 GALE 1 BLOQUEADO<br />{signal.blockReason ?? "Inércia contrária forte detetada. Proteja a banca e aguarde o próximo ciclo."}</p> : <p className="mt-1 text-sm text-muted-foreground">{signal.action}</p>}
        </article>
      ))}
      <details className="rounded-lg border border-border" open>
        <summary className="cursor-pointer px-3 py-2 text-xs font-bold">HISTÓRICO FINANCEIRO · {history.length} ENTRADAS</summary>
        <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left text-xs"><thead><tr className="border-b border-border text-muted-foreground">{["Giro","Estratégia","Alvo","Status / correção","Impacto financeiro","Ações"].map((x) => <th key={x} className="px-3 py-3">{x}</th>)}</tr></thead><tbody>{history.map((signal) => {
          const result = effectiveSignalResult(signal, ledger);
          const calculatedImpact = impactoFinanceiro(signal, bankroll, ledger);
          const impact = result === "NOT_PICKED" ? 0 : ledger.financialOverrides?.[signal.id] !== undefined ? ledger.financialOverrides[signal.id]! : calculatedImpact;
          return <tr key={signal.id} className="border-b border-border/60"><td className="px-3 py-3">#{signal.sourceIndex}</td><td className="px-3 py-3 font-bold"><span>{signal.strategyLabel}</span>{signal.preCatalog && effectiveSignalResult(signal, ledger) === "NOT_PICKED" ? (() => { const audit = signal.result === "GREEN_R1" || signal.result === "GREEN_GALE1" ? { label: "PRÉ-CATALOGAÇÃO • GREEN", style: "border border-emerald-500/30 bg-emerald-500/20 text-emerald-400" } : signal.result === "RED" ? { label: "PRÉ-CATALOGAÇÃO • RED", style: "border border-rose-500/30 bg-rose-500/20 text-rose-400" } : signal.result === "GALE_BLOCKED" ? { label: "PRÉ-CATALOGAÇÃO • GALE BLOQUEADO", style: "border border-amber-500/30 bg-amber-500/20 text-amber-400" } : { label: "PRÉ-CATALOGAÇÃO", style: "border border-slate-500/30 bg-slate-500/15 text-slate-400" }; return <span className={`mt-1 block w-fit rounded-full px-2 py-1 text-[10px] font-black ${audit.style}`}>{audit.label}</span>; })() : signal.preCatalog ? null : (signal.strategy.startsWith("volt") && /^(DÚZIAS|COLUNAS)/i.test(signal.target)) ? <span className="mt-1 block w-fit rounded-full bg-cyan-500/15 px-2 py-1 text-[10px] font-black text-cyan-300">PRIORIDADE ESTRUTURAL</span> : null}</td><td className="px-3 py-3">{signal.target}</td><td className="px-3 py-3"><select aria-label={`Corrigir resultado da entrada ${signal.sourceIndex}`} className="max-w-52 rounded border border-border bg-background px-2 py-2" value={result} onChange={(e) => correct(signal.id, e.target.value as EditableSignalResult)}>{(["PENDING", "GREEN_R1", "GREEN_GALE1", "RED", "GALE_BLOCKED", "NOT_PICKED"] as EditableSignalResult[]).map((key) => <option key={key} value={key}>{resultLabel[key]}</option>)}</select></td><td className="px-3 py-3 font-bold"><div className="flex items-center gap-2"><input aria-label={`Impacto financeiro da entrada ${signal.sourceIndex}`} type="number" step="0.5" value={ledger.financialOverrides?.[signal.id] ?? (calculatedImpact === null ? "" : calculatedImpact)} placeholder="—" onChange={(e) => { const raw = e.target.value; const financialOverrides = { ...(ledger.financialOverrides ?? {}) }; if (raw.trim() === "") delete financialOverrides[signal.id]; else if (Number.isFinite(Number(raw))) financialOverrides[signal.id] = Number(raw); updateLedger({ ...ledger, financialOverrides }); }} className="w-28 rounded border border-border bg-background px-2 py-2" /> <span className="text-muted-foreground">R$</span></div><span className={impact === null ? "text-muted-foreground" : impact > 0 ? "text-emerald-500" : impact < 0 ? "text-rose-500" : "text-muted-foreground"}>{impact === null ? "Pendente" : dinheiro(impact)}</span></td><td className="px-3 py-3"><button type="button" onClick={() => remove(signal.id)} className="rounded border border-rose-500/50 px-3 py-2 font-bold text-rose-500 hover:bg-rose-500/10">Remover</button></td></tr>;
        })}</tbody></table></div>
      </details>
    </section>
  );
}
