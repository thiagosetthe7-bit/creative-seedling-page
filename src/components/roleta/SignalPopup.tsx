import { useEffect, useRef, useState } from "react";
import type { EntrySignal } from "@/lib/roleta/signalEngine";

interface SignalPopupProps {
  signals: EntrySignal[];
  onDismiss?: () => void;
  autoCloseSeconds?: number;
}

/** Modal compacto VOLT: só abre quando surge um novo sinal validado. */
export function SignalPopup({ signals, onDismiss, autoCloseSeconds = 8 }: SignalPopupProps) {
  const [visible, setVisible] = useState(false);
  const lastSignalKey = useRef("");
  const initialized = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = signals.map((signal) => signal.id).sort().join("|");

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      lastSignalKey.current = key;
      return;
    }
    if (!key) {
      setVisible(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      return;
    }
    if (key === lastSignalKey.current) return;
    lastSignalKey.current = key;
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      timerRef.current = null;
      onDismiss?.();
    }, Math.max(0, autoCloseSeconds) * 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [key, autoCloseSeconds, onDismiss]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const close = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setVisible(false);
    onDismiss?.();
  };

  if (!visible || !signals.length) return null;
  const signal = signals[signals.length - 1]!;
  const baseTrigger = signal.strategy === "volt-delta" ? "VOLT + DELTA" : signal.strategy === "delta" ? "DELTA" : signal.name.toUpperCase().includes("DUPLO") ? "VOLT DUPLO" : "VOLT";
  const triggerName = signal.phase === "GALE1" ? `${baseTrigger} - GALE 1` : signal.phase === "GALE2" ? `${baseTrigger} - GALE 2` : baseTrigger;
  const formatTarget = (raw: string) => {
    const value = raw.trim();
    if (/^COR\s+/i.test(value)) return value.replace(/^COR\s+/i, "COR: ");
    if (/^PAR\/ÍMPAR\s+/i.test(value)) return value.replace(/^PAR\/ÍMPAR\s+/i, "P/I: ");
    if (/^ALTO\/BAIXO\s+/i.test(value)) return value.replace(/^ALTO\/BAIXO\s+/i, "A/B: ");
    return value;
  };
  const displayTarget = [signal.target, signal.deltaTarget].filter(Boolean).map(formatTarget).join(" + ");
  const targetAction = [signal.target, signal.deltaTarget].filter(Boolean).map((target) => formatTarget(target).replace(/: /g, " ")).join(" E ");

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-start justify-center bg-black/35 px-4 py-20 backdrop-blur-[2px]" aria-live="assertive">
      <section role="alertdialog" aria-modal="true" aria-labelledby="volt-popup-title" className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-amber-300/50 bg-slate-950 text-white shadow-2xl shadow-black/50 ring-1 ring-amber-200/20">
        <div className="px-6 pb-5 pt-6 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">{signal.phase === "GALE1" ? "RECUPERAÇÃO • GALE 1 • PRÓXIMO GIRO" : signal.phase === "GALE2" ? "RECUPERAÇÃO • GALE 2 • PRÓXIMO GIRO" : "SINAL DE ENTRADA • PRÓXIMO GIRO"}</p>
          <h2 id="volt-popup-title" className="mt-3 text-2xl font-black tracking-tight text-amber-300">⚡ GATILHO ATIVO: {triggerName}</h2>
          <div className="mt-5 flex justify-center">
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-bold tracking-wider text-emerald-300">CONDIÇÕES DO PADRÃO: COMPLETAS</span>
          </div>
          <div className="mt-5 rounded-xl border border-amber-300/50 bg-amber-300/[0.07] px-4 py-5">
            <p className="text-[10px] font-bold tracking-[0.2em] text-amber-200/80">ALVO IDENTIFICADO</p>
            <p className="mt-2 text-2xl font-black leading-tight text-amber-300">{displayTarget}</p>
            <p className="mt-3 text-sm font-extrabold uppercase leading-relaxed text-white">APOSTAR EM {targetAction} NO PRÓXIMO GIRO.</p>
          </div>
          <p className="mt-5 text-[10px] font-semibold tracking-wide text-slate-400">CONFIANÇA DO PADRÃO: REGRAS CONFIGURADAS ATENDIDAS</p>
          <button type="button" onClick={close} className="mt-5 min-h-12 w-full rounded-xl bg-amber-300 px-5 py-3 text-sm font-black tracking-wide text-slate-950 shadow-lg shadow-amber-500/15 transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300">ENTENDIDO / FECHAR</button>
        </div>
      </section>
    </div>
  );
}
