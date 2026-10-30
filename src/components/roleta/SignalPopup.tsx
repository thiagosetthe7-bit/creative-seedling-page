import { useEffect, useRef, useState } from "react";
import type { EntrySignal } from "@/lib/roleta/signalEngine";

interface SignalPopupProps {
  signals: EntrySignal[];
  onDismiss?: () => void;
  autoCloseSeconds?: number;
}

/**
 * Alerta VOLT não bloqueante: aparece apenas quando surge um novo ID de sinal.
 * A camada externa não captura cliques, permitindo continuar a catalogar giros.
 */
export function SignalPopup({ signals, onDismiss, autoCloseSeconds = 8 }: SignalPopupProps) {
  const [visible, setVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(autoCloseSeconds);
  const lastSignalKey = useRef("");
  const initialized = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const key = signals.map((signal) => signal.id).sort().join("|");

  useEffect(() => {
    // Não alertar por sinais antigos já presentes ao abrir/recarregar a página.
    if (!initialized.current) {
      initialized.current = true;
      lastSignalKey.current = key;
      return;
    }
    if (!key) {
      lastSignalKey.current = "";
      setVisible(false);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    // Um mesmo sinal não volta a abrir depois de ser fechado; um novo ID abre.
    if (key === lastSignalKey.current) return;
    lastSignalKey.current = key;
    setSecondsLeft(autoCloseSeconds);
    setVisible(true);
    if (timerRef.current) clearInterval(timerRef.current);
    let remaining = autoCloseSeconds;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(Math.max(remaining, 0));
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setVisible(false);
        onDismiss?.();
      }
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [key, autoCloseSeconds, onDismiss]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  if (!visible || !signals.length) return null;

  const close = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setVisible(false);
    onDismiss?.();
  };

  return (
    <div className="pointer-events-none fixed right-3 top-20 z-[100] w-[min(26rem,calc(100vw-1.5rem))] sm:right-5 sm:top-24" aria-live="assertive">
      <section role="status" aria-labelledby="volt-popup-title" className="pointer-events-auto overflow-hidden rounded-xl border border-amber-300/70 bg-slate-950 text-white shadow-2xl shadow-black/40 ring-1 ring-amber-300/20">
        <div className="flex items-center gap-2 border-b border-amber-300/25 bg-amber-300/10 px-4 py-3">
          <span aria-hidden="true" className="text-xl">🚨</span>
          <h2 id="volt-popup-title" className="text-sm font-black tracking-wide text-amber-300">SINAL VOLT CONFIRMADO!</h2>
          <span className="ml-auto rounded-full border border-white/15 px-2 py-1 text-[10px] text-slate-300">{secondsLeft}s</span>
        </div>
        <div className="space-y-3 p-4">
          {signals.map((signal) => (
            <article key={signal.id} className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Estratégia: VOLT</p>
              <p className="text-xs font-semibold text-slate-300">ALVO PRINCIPAL</p>
              <p className="text-xl font-black leading-tight text-amber-300">{signal.target}</p>
              <p className="text-sm leading-relaxed text-slate-200">{signal.action || `Alvo identificado: ${signal.target}. Confira o histórico antes de qualquer decisão.`}</p>
              <p className="text-xs leading-relaxed text-slate-400">{signal.explanation}</p>
            </article>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
          <p className="text-[10px] text-slate-400">O aviso fecha sozinho; a catalogação continua disponível.</p>
          <button type="button" onClick={close} className="shrink-0 rounded-lg bg-amber-300 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300">ENTENDIDO / FECHAR</button>
        </div>
      </section>
    </div>
  );
}
