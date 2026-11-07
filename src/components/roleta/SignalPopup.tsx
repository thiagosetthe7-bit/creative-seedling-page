import { useEffect, useRef, useState } from "react";
import type { EntrySignal } from "@/lib/roleta/signalEngine";

interface SignalPopupProps { signals: EntrySignal[]; onDismiss?: () => void; autoCloseSeconds?: number; }
export function SignalPopup({ signals, onDismiss, autoCloseSeconds = 15 }: SignalPopupProps) {
  const [visible, setVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(autoCloseSeconds);
  const lastKey = useRef("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const key = signals.map((signal) => signal.id).join("|");
  useEffect(() => {
    if (!key) { setVisible(false); lastKey.current = ""; return; }
    if (key === lastKey.current) return;
    lastKey.current = key; setVisible(true); setSecondsLeft(autoCloseSeconds);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setSecondsLeft((value) => {
      if (value <= 1) { if (timer.current) clearInterval(timer.current); timer.current = null; setVisible(false); onDismiss?.(); return 0; }
      return value - 1;
    }), 1000);
    return () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  }, [key, autoCloseSeconds, onDismiss]);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const close = () => { if (timer.current) clearInterval(timer.current); timer.current = null; setVisible(false); onDismiss?.(); };
  if (!visible || !signals.length) return null;
  const signal = signals[0]!;
  const high = signal.macroState === "HIGH_SIGNAL";
  const title = "SINAL DE ALTA FIRMEZA • CONFLUÊNCIA VOLT";
  return <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-md" aria-live="assertive">
    <section role="alertdialog" aria-modal="true" aria-labelledby="macro-signal-title" className={`pointer-events-auto w-full max-w-lg overflow-hidden rounded-3xl border bg-slate-950/95 text-white shadow-2xl ${high ? "border-emerald-400/70 shadow-emerald-500/20" : "border-cyan-400/70 shadow-cyan-500/20"}`}>
      <div className={`h-2 ${high ? "bg-emerald-400" : "bg-cyan-400"}`} />
      <div className="p-6 sm:p-8">
        <p className="text-xs font-black tracking-[0.22em] text-slate-400">MEMÓRIA MACRO • ALERTA DE MESA</p>
        <h2 id="macro-signal-title" className={`mt-3 text-3xl font-black sm:text-4xl ${high ? "text-emerald-300" : "text-cyan-300"}`}>{title}</h2>
        <div className="mt-5 rounded-2xl border border-white/15 bg-white/5 p-5">
          <p className="text-xs font-black tracking-widest text-slate-400">ALVO PRINCIPAL</p>
          <p className="mt-2 text-2xl font-black">{signal.target}</p>
          {signal.deltaTarget && <><p className="mt-4 text-xs font-black tracking-widest text-slate-400">SETOR EM CONFLUÊNCIA</p><p className="mt-2 text-2xl font-black text-cyan-200">{signal.deltaTarget}</p></>}
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-200">{signal.action}</p>
        <div className="mt-5 flex items-center justify-between text-xs text-slate-400"><span>Fechamento em <strong className="text-white">{secondsLeft}s</strong></span><span>Somente leitura macro</span></div>
        <button type="button" onClick={close} className="mt-5 min-h-14 w-full rounded-xl bg-gradient-to-r from-emerald-300 to-cyan-300 px-5 py-3 text-base font-black tracking-widest text-slate-950">ENTENDIDO / FECHAR</button>
      </div>
    </section>
  </div>;
}
