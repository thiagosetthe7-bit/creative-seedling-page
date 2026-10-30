import { useEffect, useRef, useState } from "react";
import type { EntrySignal } from "@/lib/roleta/signalEngine";

interface SignalPopupProps {
  signals: EntrySignal[];
  onDismiss?: () => void;
  stakeR1Total?: number;
  stakeR2Total?: number;
}
export function SignalPopup({ signals, onDismiss, stakeR1Total, stakeR2Total }: SignalPopupProps) {
  const [open, setOpen] = useState(false);
  const [dismissedKey, setDismissedKey] = useState("");
  const previousKey = useRef("");
  const key = signals.map((signal) => signal.id).sort().join("|");
  useEffect(() => {
    if (!signals.length) { setOpen(false); previousKey.current = ""; setDismissedKey(""); return; }
    if (key !== previousKey.current) { previousKey.current = key; setDismissedKey(""); setOpen(true); }
    else if (dismissedKey !== key) setOpen(true);
  }, [key, signals.length, dismissedKey]);
  if (!open || !signals.length) return null;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="volt-popup-title" className="w-full max-w-2xl space-y-4 rounded-xl border border-amber-300 bg-slate-950 p-5 text-white">
      <h2 id="volt-popup-title" className="text-2xl font-black text-amber-300">VOLT · PADRÃO OBSERVADO</h2>
      {signals.map((signal) => <article key={signal.id} className="space-y-2 rounded-lg border border-white/20 p-4">
        <h3 className="font-bold">{signal.name}</h3><p className="text-xl font-black">{signal.target}</p><p className="text-sm text-slate-300">{signal.explanation}</p><p className="text-sm">{signal.action}</p>
      </article>)}
      {(stakeR1Total !== undefined || stakeR2Total !== undefined) && <p className="text-xs text-slate-400">Valores configurados para exibição: R1 {stakeR1Total ?? "—"} · R2 {stakeR2Total ?? "—"}. Não representam garantia de resultado.</p>}
      <button type="button" className="w-full rounded-lg bg-amber-300 px-4 py-3 font-black text-black" onClick={() => { setDismissedKey(key); setOpen(false); onDismiss?.(); }}>FECHAR</button>
    </section>
  </div>;
}
