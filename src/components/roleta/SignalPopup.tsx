import { useEffect, useRef, useState } from "react";
import { isSuperGatilho, type EntrySignal } from "@/lib/roleta/signalEngine";
import type { SmartGaleDecision } from "@/lib/roleta/smartGale";

interface SignalPopupProps {
  signals: EntrySignal[];
  smartGale?: SmartGaleDecision | null;
  onDismiss?: () => void;
}

function tocarAlerta() {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext
    || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  let context: AudioContext | undefined;
  try {
    context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.setValueAtTime(660, context.currentTime + 0.13);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.32);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.34);
    oscillator.onended = () => { void context?.close().catch(() => undefined); };
  } catch {
    void context?.close().catch(() => undefined);
  }
}

export function SignalPopup({ signals, smartGale = null, onDismiss }: SignalPopupProps) {
  const [open, setOpen] = useState(false);
  const [dismissedKey, setDismissedKey] = useState("");
  const previousKey = useRef("");
  const key = [...signals.map((signal) => signal.id), ...(smartGale ? [smartGale.id] : [])].sort().join("|");
  const hasContent = signals.length > 0 || smartGale !== null;
  const superGatilho = isSuperGatilho(signals);

  useEffect(() => {
    if (!hasContent) {
      setOpen(false);
      previousKey.current = "";
      setDismissedKey("");
      return;
    }
    if (key !== previousKey.current) {
      previousKey.current = key;
      setDismissedKey("");
      setOpen(true);
      tocarAlerta();
    } else if (dismissedKey !== key) {
      setOpen(true);
    }
  }, [key, hasContent, dismissedKey]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDismissedKey(key);
        setOpen(false);
        onDismiss?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, key, onDismiss]);

  if (!open || !hasContent) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/90 p-3 backdrop-blur-sm sm:p-6"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="signal-popup-title"
        className="my-auto max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border-2 border-amber-300 bg-slate-950 text-white shadow-[0_0_70px_rgba(250,204,21,0.22)]"
      >
        <header className="border-b border-amber-300/30 bg-gradient-to-r from-amber-400/20 via-slate-900 to-slate-900 p-5 sm:p-7">
          <p className="text-xs font-black tracking-[0.24em] text-amber-300">
            {smartGale ? "ANÁLISE CONTEXTUAL R1 · GALE 1 MÁXIMO" : "SINAL DE ENTRADA · PRÓXIMO GIRO"}
          </p>
          <h2 id="signal-popup-title" className="mt-2 text-2xl font-black sm:text-4xl">
            {smartGale
              ? "🧠 SMART GALE 1 · ANÁLISE DE CONTEXTO"
              : signals[0]?.strategy === "bt-concomitante"
                ? "⏱️ GATILHO ATIVO: BT CONCOMITANTE"
                : signals[0]?.strategy === "volt-duplo"
                  ? "⚡ GATILHO ATIVO: VOLT DUPLO"
                  : signals[0]?.strategy === "delta"
                    ? "🎯 GATILHO ATIVO: DELTA"
                    : "🔔 GATILHO ATIVO: BR ANTECEDENTE"}
          </h2>
          {superGatilho && (
            <div className="mt-4 inline-flex rounded-lg border border-fuchsia-300 bg-fuchsia-500/20 px-4 py-2 text-sm font-black tracking-widest text-fuchsia-200">
              ✨ SUPER GATILHO · VOLT + BR
            </div>
          )}
        </header>

        <div className="space-y-4 p-5 sm:p-7">
          {smartGale && (
            <article
              role="status"
              className={smartGale.status === "APPROVED"
                ? "rounded-xl border-2 border-amber-300 bg-amber-300/10 p-4 sm:p-5"
                : "rounded-xl border-2 border-rose-400 bg-rose-500/10 p-4 sm:p-5"}
            >
              <p className={smartGale.status === "APPROVED"
                ? "text-base font-black leading-relaxed text-amber-200 sm:text-lg"
                : "text-base font-black leading-relaxed text-rose-200 sm:text-lg"}>
                {smartGale.title}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-200">{smartGale.reason}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-full border border-white/20 px-3 py-1">R1 registrado: {smartGale.r1Number}</span>
                <span className="rounded-full border border-white/20 px-3 py-1">Nível máximo permitido: GALE 1</span>
              </div>
            </article>
          )}

          {signals.map((signal) => (
            <article key={signal.id} className="rounded-xl border border-white/15 bg-white/[0.04] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-black text-amber-200">{signal.name}</h3>
                <span className="rounded-full border border-emerald-300/50 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">CONDIÇÕES DO PADRÃO: COMPLETAS</span>
                {signal.confluence && signal.confluence.length > 1 && (
                  <span className="rounded-full border border-fuchsia-300/50 bg-fuchsia-500/10 px-3 py-1 text-xs font-black text-fuchsia-200">
                    MATRIZ UNIFICADA: {signal.confluence.map((id) => id === "volt-duplo" ? "VOLT" : id === "delta" ? "DELTA" : id === "br-antecedente" ? "BR" : "BT").join(" + ")}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs font-bold tracking-wide text-cyan-200">CONFIANÇA DO PADRÃO: REGRAS CONFIGURADAS ATENDIDAS (NÃO É PROBABILIDADE DE GANHO)</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{signal.explanation}</p>
              <div className="mt-4 rounded-lg border border-amber-300/50 bg-amber-300/10 p-4">
                <p className="text-[10px] font-black tracking-[0.2em] text-amber-200">ALVO IDENTIFICADO</p>
                <p className="mt-1 text-lg font-black">{signal.target}</p>
                <p className="mt-3 text-sm font-black leading-relaxed text-white sm:text-base">{signal.action}</p>
              </div>
            </article>
          ))}
          <p className="text-xs leading-relaxed text-slate-400">
            A análise contextual não garante resultado futuro. Gale 2 é proibido e não existe neste módulo; uma autorização é apenas uma avaliação do padrão, não uma garantia de recuperação.
          </p>
        </div>

        <footer className="sticky bottom-0 border-t border-white/10 bg-slate-950 p-4 sm:p-5">
          <button
            type="button"
            autoFocus
            onClick={() => {
              setDismissedKey(key);
              setOpen(false);
              onDismiss?.();
            }}
            className="w-full rounded-xl bg-amber-300 px-5 py-4 text-base font-black tracking-widest text-slate-950 transition hover:bg-amber-200 focus:outline-none focus:ring-4 focus:ring-amber-300/40"
          >
            ENTENDIDO / FECHAR
          </button>
        </footer>
      </section>
    </div>
  );
}
