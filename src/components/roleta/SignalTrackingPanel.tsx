import { useEffect, useState } from "react";
import type { TrackedSignal } from "@/lib/roleta/signalTracking";
import { effectiveSignalResult, loadSessionFinance, saveSessionFinance, SESSION_FINANCE_EVENT, type EditableSignalResult, type SessionFinanceLedger } from "@/lib/roleta/sessionFinance";

interface SignalTrackingPanelProps { signals: TrackedSignal[]; }
const resultLabel: Record<EditableSignalResult, string> = { PENDING: "Pendente", GREEN_R1: "Green R1", GREEN_GALE1: "Green Gale 1", GREEN_GALE2: "Green Gale 2", RED: "Red", NOT_PICKED: "Não Peguei", BLOCKED: "Bloqueado", GALE_BLOCKED: "Gale Bloqueado", PARTIAL_RED: "Red Parcial", NO_SIGNAL: "Pendente" };

export function SignalTrackingPanel({ signals }: SignalTrackingPanelProps) {
  const [ledger, setLedger] = useState<SessionFinanceLedger>(() => loadSessionFinance());
  useEffect(() => {
    const sync = () => setLedger(loadSessionFinance());
    window.addEventListener(SESSION_FINANCE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(SESSION_FINANCE_EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  const visible = signals.filter((signal) => !ledger.removedSignalIds.includes(signal.id));
  const active = visible.filter((s) => s.status !== "CONCLUÍDO").slice().reverse();
  const updateLedger = (next: SessionFinanceLedger) => { setLedger(next); saveSessionFinance(next); };
  const correct = (id: string, result: EditableSignalResult) => updateLedger({ ...ledger, corrections: { ...ledger.corrections, [id]: result } });
  const remove = (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("Remover esta entrada do histórico e excluir seu impacto financeiro?")) return;
    updateLedger({ ...ledger, removedSignalIds: [...new Set([...ledger.removedSignalIds, id])] });
  };
  const history = visible.slice().reverse();
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label="Histórico de sinais da catalogação">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-black tracking-widest">HISTÓRICO FINANCEIRO</h2>
      </div>
      {active.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhum sinal aguardando resolução. Os sinais detectados permanecerão no histórico.</p> : active.map((signal) => (
        <article key={signal.id} className="rounded-lg border border-amber-400/40 bg-amber-400/5 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-black">{signal.strategyLabel}</h3><span className={signal.status === "GALE 1 EM ANDAMENTO" ? "rounded-full bg-orange-500/15 px-3 py-1 text-xs font-black text-orange-400" : "rounded-full bg-sky-500/15 px-3 py-1 text-xs font-black text-sky-400"}>{signal.status}</span></div>
          <p className="mt-2 text-sm font-bold">{signal.target}</p><p className="mt-1 text-sm text-muted-foreground">{signal.action}</p>
        </article>
      ))}
      <details className="rounded-lg border border-border" open>
        <summary className="cursor-pointer px-3 py-2 text-xs font-bold">HISTÓRICO FINANCEIRO · {history.length} ENTRADAS</summary>
        <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left text-xs"><thead><tr className="border-b border-border text-muted-foreground">{["Giro","Estratégia","Alvo","Status / correção","Ações"].map((x) => <th key={x} className="px-3 py-3">{x}</th>)}</tr></thead><tbody>{history.map((signal) => {
          const result = effectiveSignalResult(signal, ledger);
          return <tr key={signal.id} className="border-b border-border/60"><td className="px-3 py-3">#{signal.sourceIndex}</td><td className="px-3 py-3 font-bold">{signal.strategyLabel}</td><td className="px-3 py-3">{signal.target}</td><td className="px-3 py-3"><select aria-label={`Corrigir resultado da entrada ${signal.sourceIndex}`} className="max-w-52 rounded border border-border bg-background px-2 py-2" value={result} onChange={(e) => correct(signal.id, e.target.value as EditableSignalResult)}>{Object.entries(resultLabel).filter(([key]) => key !== "NO_SIGNAL" && (key !== "RED" || signal.result === "RED" || signal.result === "GREEN_GALE1" || result === "GREEN_GALE2" || signal.status === "GALE 1 EM ANDAMENTO" || result === "RED" || result === "GREEN_GALE1")).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></td><td className="px-3 py-3"><button type="button" onClick={() => remove(signal.id)} className="rounded border border-rose-500/50 px-3 py-2 font-bold text-rose-500 hover:bg-rose-500/10">Remover / Corrigir</button></td></tr>;
        })}</tbody></table></div>
      </details>
    </section>
  );
}
