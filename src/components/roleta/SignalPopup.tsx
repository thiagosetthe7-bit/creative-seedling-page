import { useEffect, useRef, useState } from "react";
import type { EntrySignal } from "@/lib/roleta/signalEngine";

interface SignalPopupProps {
  signals: EntrySignal[];
  onDismiss?: () => void;
  autoCloseSeconds?: number;
}

export function SignalPopup({ signals, onDismiss, autoCloseSeconds = 15 }: SignalPopupProps) {
  const [visible, setVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(autoCloseSeconds);
  const lastSignalKey = useRef("");
  const initialized = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const key = signals.map((signal) => signal.id).sort().join("|");

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      lastSignalKey.current = key;
      return;
    }
    if (!key) {
      setVisible(false);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    if (key === lastSignalKey.current) return;
    lastSignalKey.current = key;
    setVisible(true);
    setSecondsLeft(autoCloseSeconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          setVisible(false);
          onDismiss?.();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [key, autoCloseSeconds, onDismiss]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const close = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setVisible(false);
    onDismiss?.();
  };

  if (!visible || !signals.length) return null;
  const signal = signals[signals.length - 1]!;
  const baseTrigger = signal.strategy === "volt-delta"
    ? "VOLT + DELTA"
    : signal.strategy === "delta-a" ? "DELTA A"
    : signal.strategy === "delta-b" ? "DELTA B"
    : signal.strategy === "volt-a" ? "VOLT A" : "VOLT B";
  const triggerName = signal.phase === "GALE1" ? `${baseTrigger} - GALE 1` : baseTrigger;
  const formatTarget = (raw: string) => raw
    .replace(/^PAR\/ÍMPAR:\s*/i, "P/I: ")
    .replace(/^ALTO\/BAIXO:\s*/i, "A/B: ")
    .toUpperCase();

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 py-8 backdrop-blur-md" aria-live="assertive">
      <section role="alertdialog" aria-modal="true" aria-labelledby="signal-popup-title" className="pointer-events-auto w-full max-w-lg overflow-hidden rounded-3xl border border-cyan-300/30 bg-slate-950/95 text-white shadow-2xl shadow-cyan-950/40 ring-1 ring-white/10 backdrop-blur-xl">
        <div className="h-1 w-full bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400" />
        <div className="px-6 pb-6 pt-6 sm:px-8">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">SINAL DE ENTRADA • PRÓXIMO GIRO</p>
            <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[10px] font-black tracking-wider text-cyan-200">{signal.strategy.toUpperCase()}</span>
          </div>
          <h2 id="signal-popup-title" className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">{triggerName}</h2>
          <div className="mt-5 rounded-2xl border border-cyan-300/30 bg-cyan-300/[0.06] px-4 py-5 shadow-[0_0_32px_rgba(34,211,238,0.07)] sm:px-5">
            <p className="text-[10px] font-black tracking-[0.22em] text-cyan-200/80">ALVO IDENTIFICADO</p>
            <p className="mt-2 break-words text-2xl font-black leading-tight text-cyan-100 sm:text-3xl">{formatTarget(signal.target)}{signal.deltaTarget ? ` + ${formatTarget(signal.deltaTarget)}` : ""}</p>
            <p className="mt-4 text-sm font-bold leading-relaxed text-white">{signal.action}</p>
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[10px] font-black tracking-[0.18em] text-slate-400">JUSTIFICATIVA / ANÁLISE</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{signal.explanation}</p>
          </div>
          <div className="mt-5 flex items-center justify-between gap-4 text-xs text-slate-400">
            <span>Fechamento automático em <strong className="text-cyan-200">{secondsLeft}s</strong></span>
            <span className="rounded-full bg-white/5 px-3 py-1 font-bold">{signal.phase ?? "R1"}</span>
          </div>
          <button type="button" onClick={close} className="mt-5 min-h-12 w-full rounded-xl bg-cyan-200 px-5 py-3 text-sm font-black tracking-wide text-slate-950 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">ENTENDIDO / FECHAR</button>
        </div>
      </section>
    </div>
  );
}
