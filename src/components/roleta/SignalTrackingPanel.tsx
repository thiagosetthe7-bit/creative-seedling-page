import type { TrackedSignal } from "@/lib/roleta/signalTracking";

interface SignalTrackingPanelProps {
  signals: TrackedSignal[];
}
export function SignalTrackingPanel({ signals }: SignalTrackingPanelProps) {
  const greens = signals.filter((s) => s.result === "GREEN_R1" || s.result === "GREEN_GALE1").length;
  const reds = signals.filter((s) => s.result === "RED").length;
  const total = greens + reds;
  const rate = total ? Math.round((greens / total) * 100) : 0;
  const active = signals.filter((s) => s.status !== "CONCLUÍDO").slice().reverse();
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label="Acompanhamento de sinais">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-black tracking-widest">ACOMPANHAMENTO DE SINAIS</h2>
        <div className="flex flex-wrap gap-2 text-xs font-black">
          <span className="rounded-lg bg-emerald-500/15 px-3 py-2 text-emerald-500">GREENS: {greens}</span>
          <span className="rounded-lg bg-rose-500/15 px-3 py-2 text-rose-500">REDS: {reds}</span>
          <span className="rounded-lg border border-border px-3 py-2">WIN RATE: {rate}%</span>
        </div>
      </div>
      {active.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhum sinal aguardando resolução. Os sinais detectados permanecerão registrados no histórico.</p>
      ) : active.map((signal) => (
        <article key={signal.id} className="rounded-lg border border-amber-400/40 bg-amber-400/5 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-black">{signal.strategyLabel}</h3>
            <span className={signal.status === "GALE 1 EM ANDAMENTO" ? "rounded-full bg-orange-500/15 px-3 py-1 text-xs font-black text-orange-400" : "rounded-full bg-sky-500/15 px-3 py-1 text-xs font-black text-sky-400"}>{signal.status}</span>
          </div>
          <p className="mt-2 text-sm font-bold">{signal.target}</p>
          <p className="mt-1 text-sm text-muted-foreground">{signal.action}</p>
          {signal.galeReason && <p className="mt-2 text-xs text-muted-foreground">Contexto Smart Gale 1: {signal.galeReason}</p>}
        </article>
      ))}
      <details className="rounded-lg border border-border">
        <summary className="cursor-pointer px-3 py-2 text-xs font-bold">HISTÓRICO DE RESULTADOS ({signals.length})</summary>
        <div className="max-h-64 space-y-2 overflow-auto p-3">
          {signals.slice().reverse().map((signal) => (
            <div key={signal.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 text-xs">
              <span className="font-bold">{signal.strategyLabel} · giro {signal.sourceIndex} · {signal.target}</span>
              <span className={signal.result.startsWith("GREEN") ? "font-black text-emerald-500" : signal.result === "RED" ? "font-black text-rose-500" : "text-muted-foreground"}>{signal.result === "NO_SIGNAL" ? signal.status : signal.result}</span>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
