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
      <section role="alertdialog" aria-modal="true" aria-labelledby="signal-popup-title" className="pointer-events-auto w-full max-w-lg overflow-hidden rounded-3xl border border-fuchsia-400/60 bg-slate-950/95 text-white shadow-[0_0_70px_rgba(217,70,239,0.28)] ring-2 ring-cyan-300/30 backdrop-blur-xl">
        <div className="h-2 w-full bg-gradient-to-r from-lime-300 via-cyan-300 via-40% to-fuchsia-500 shadow-[0_0_25px_rgba(34,211,238,0.8)]" />
        <div className="px-6 pb-6 pt-6 sm:px-8">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">SINAL DE ENTRADA • PRÓXIMO GIRO</p>
            <span className="rounded-full border border-fuchsia-300/70 bg-gradient-to-r from-fuchsia-500/30 to-violet-500/30 px-3 py-1.5 text-[10px] font-black tracking-wider text-fuchsia-100 shadow-[0_0_18px_rgba(217,70,239,0.35)]">{signal.strategy.toUpperCase()}</span>
          </div>
          <h2 id="signal-popup-title" className="mt-4 bg-gradient-to-r from-lime-200 via-cyan-200 to-fuchsia-300 bg-clip-text text-3xl font-black tracking-tight text-transparent drop-shadow-[0_0_16px_rgba(34,211,238,0.3)] sm:text-4xl">{triggerName}</h2>
          <div className="mt-5 rounded-2xl border border-cyan-300/60 bg-gradient-to-br from-cyan-400/15 via-blue-500/10 to-fuchsia-500/15 px-4 py-5 shadow-[0_0_38px_rgba(34,211,238,0.16)] ring-1 ring-white/10 sm:px-5">
            <p className="text-xs font-black tracking-[0.24em] text-lime-200">ALVO IDENTIFICADO</p>
            <p className="mt-2 break-words text-3xl font-black leading-tight text-white drop-shadow-[0_0_15px_rgba(34,211,238,0.65)] sm:text-4xl">{formatTarget(signal.target)}{signal.deltaTarget ? ` + ${formatTarget(signal.deltaTarget)}` : ""}</p>
            <p className="mt-4 text-sm font-bold leading-relaxed text-white">{signal.action}</p>
          </div>
          <div className="mt-5 flex items-center justify-between gap-4 text-xs text-slate-400">
            <span>Fechamento automático em <strong className="text-cyan-200">{secondsLeft}s</strong></span>
            <span className="rounded-full bg-white/5 px-3 py-1 font-bold">{signal.phase ?? "R1"}</span>
          </div>
          <button type="button" onClick={close} className="mt-5 min-h-14 w-full rounded-xl border border-lime-100/80 bg-gradient-to-r from-lime-300 via-cyan-300 to-fuchsia-400 px-5 py-3 text-base font-black tracking-widest text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.32)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-200">ENTENDIDO / FECHAR</button>
        </div>
      </section>
    </div>
  );
}
