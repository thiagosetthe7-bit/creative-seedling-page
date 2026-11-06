import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { EntrySignal } from "@/lib/roleta/signalEngine";
import { getReliability, getReliabilityVersion, subscribeReliability } from "@/lib/roleta/signalReliability";

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
  useSyncExternalStore(subscribeReliability, getReliabilityVersion, () => 0);
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
  // Prioridade do modal: confluência VOLT+DELTA > VOLT A/B > DELTA A/B > recuperação Gale.
  // Assim, um alerta estrutural novo substitui imediatamente um modal secundário de recuperação.
  const calibrationWeight: Record<EntrySignal["strategy"], number> = {
    "volt-b": 0.875, "delta-b": 0.857, "volt-a": 0.855, "volt-delta": 0.75, "delta-a": 0.667,
  };
  const prioritizedSignals = [...signals].sort((a, b) =>
    (calibrationWeight[b.strategy] ?? 0.5) - (calibrationWeight[a.strategy] ?? 0.5) ||
    Number(Boolean(b.blocked)) - Number(Boolean(a.blocked))
  );
  const signal = prioritizedSignals[0]!;
  const secondarySignals = prioritizedSignals.slice(1);
  const isStructuralPriority = signal.strategy === "volt-delta" || signal.strategy === "volt-a" || signal.strategy === "volt-b";
  const isConfluence = signal.strategy === "volt-delta" && Boolean(signal.deltaTarget);
  const baseTrigger = signal.strategy === "volt-delta"
    ? "VOLT + DELTA"
    : signal.strategy === "delta-a" ? "DELTA A"
    : signal.strategy === "delta-b" ? "DELTA B"
    : signal.strategy === "volt-a" ? "VOLT A" : "VOLT B";
  const triggerName = signal.blocked ? `${baseTrigger} - GALE 1 BLOQUEADO` : signal.phase === "GALE1" ? `${baseTrigger} - GALE 1` : baseTrigger;
  const formatTarget = (raw: string) => raw
    .replace(/^PAR\/ÍMPAR:\s*/i, "P/I: ")
    .replace(/^ALTO\/BAIXO:\s*/i, "A/B: ")
    .toUpperCase();

  const primaryReliability = isConfluence
    ? getReliability(signal.strategy, signal.target)
    : {
        percent: signal.confidencePercent ?? null,
        sampleSize: signal.confidenceSampleSize ?? 0,
        level: signal.confidenceLevel ?? "INSUFFICIENT",
      };
  const secondaryReliability = isConfluence
    ? getReliability(signal.strategy, signal.deltaTarget!)
    : null;

  const reliabilityBadge = (label: string, reliability: { percent: number | null; sampleSize: number; level: "HIGH" | "LOW" | "INSUFFICIENT" }) => (
    <div className={`mt-3 rounded-xl border px-4 py-3 text-sm font-black tracking-wide ${
      reliability.level === "HIGH" ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-200 shadow-[0_0_28px_rgba(52,211,153,0.2)]"
      : reliability.level === "LOW" ? "border-amber-400/60 bg-amber-400/15 text-amber-200 shadow-[0_0_24px_rgba(251,191,36,0.15)]"
      : "border-slate-400/40 bg-slate-400/10 text-slate-200"
    }`}>
      {reliability.level === "HIGH" ? "🟢 ALTA CONFIABILIDADE" : reliability.level === "LOW" ? "🟡 BAIXA CONFIABILIDADE" : "⚪ CONFIABILIDADE NÃO ESTABELECIDA"}
      {reliability.percent !== null ? ` • ${reliability.percent.toFixed(1)}% ASSERTIVIDADE` : " • sem amostra resolvida"}
      <span className="mt-1 block text-[10px] font-semibold opacity-80">{label} • {reliability.sampleSize} resultados resolvidos • referência de 75%</span>
    </div>
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 py-8 backdrop-blur-md" aria-live="assertive">
      <section role="alertdialog" aria-modal="true" aria-labelledby="signal-popup-title" className="pointer-events-auto w-full max-w-lg overflow-hidden rounded-3xl border border-fuchsia-400/60 bg-slate-950/95 text-white shadow-[0_0_70px_rgba(217,70,239,0.28)] ring-2 ring-cyan-300/30 backdrop-blur-xl">
        <div className="h-2 w-full bg-gradient-to-r from-lime-300 via-cyan-300 via-40% to-fuchsia-500 shadow-[0_0_25px_rgba(34,211,238,0.8)]" />
        <div className="px-6 pb-6 pt-6 sm:px-8">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">SINAL DE ENTRADA • PRÓXIMO GIRO</p>
            <span className="rounded-full border border-fuchsia-300/70 bg-gradient-to-r from-fuchsia-500/30 to-violet-500/30 px-3 py-1.5 text-[10px] font-black tracking-wider text-fuchsia-100 shadow-[0_0_18px_rgba(217,70,239,0.35)]">{signal.strategy.toUpperCase()}</span>
          </div>
          {signal.confidencePercent === undefined && (
            <p className="mt-2 text-[10px] font-semibold text-slate-400">Referência histórica calibrada • {signal.strategy.toUpperCase()}</p>
          )}
          {isStructuralPriority && (
            <div role="status" className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-300/80 bg-gradient-to-r from-amber-300/25 via-yellow-300/20 to-emerald-300/20 px-4 py-2 text-xs font-black tracking-[0.16em] text-amber-100 shadow-[0_0_26px_rgba(251,191,36,0.3)]">
              <span aria-hidden="true">✦</span> PRIORIDADE ESTRUTURAL
            </div>
          )}
          <div className="mt-3 inline-flex rounded-full border border-amber-300/60 bg-amber-300/15 px-3 py-1.5 text-[10px] font-black tracking-wide text-amber-100">{signal.tagVisual ?? "⭐ RECOMENDADO (MAIOR WR)"} • WR {signal.winRate ?? `${(calibrationWeight[signal.strategy] * 100).toFixed(1)}%`}</div>
          <h2 id="signal-popup-title" className="mt-4 bg-gradient-to-r from-lime-200 via-cyan-200 to-fuchsia-300 bg-clip-text text-3xl font-black tracking-tight text-transparent drop-shadow-[0_0_16px_rgba(34,211,238,0.3)] sm:text-4xl">{triggerName}</h2>

          {isConfluence ? (
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-cyan-300/60 bg-gradient-to-br from-cyan-400/15 via-blue-500/10 to-cyan-500/15 px-4 py-5 shadow-[0_0_34px_rgba(34,211,238,0.16)] ring-1 ring-white/10 sm:px-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black tracking-[0.2em] text-cyan-200">BLOCO 1 • MOTOR VOLT</p>
                  <span className="rounded-full border border-cyan-300/50 bg-cyan-300/15 px-2.5 py-1 text-[10px] font-black text-cyan-100">ESTRUTURAL</span>
                </div>
                <p className="mt-3 text-[10px] font-black tracking-[0.2em] text-lime-200">ALVO VOLT</p>
                <p className="mt-1 break-words text-2xl font-black leading-tight text-white drop-shadow-[0_0_14px_rgba(34,211,238,0.6)] sm:text-3xl">{formatTarget(signal.target)}</p>
                {reliabilityBadge("ASSERTIVIDADE DO EIXO VOLT", primaryReliability)}
              </div>
              <div className="rounded-2xl border border-fuchsia-300/60 bg-gradient-to-br from-fuchsia-400/15 via-violet-500/10 to-pink-500/15 px-4 py-5 shadow-[0_0_34px_rgba(217,70,239,0.14)] ring-1 ring-white/10 sm:px-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black tracking-[0.2em] text-fuchsia-200">BLOCO 2 • MOTOR DELTA</p>
                  <span className="rounded-full border border-fuchsia-300/50 bg-fuchsia-300/15 px-2.5 py-1 text-[10px] font-black text-fuchsia-100">CONFLUÊNCIA</span>
                </div>
                <p className="mt-3 text-[10px] font-black tracking-[0.2em] text-fuchsia-200">ALVO DELTA</p>
                <p className="mt-1 break-words text-2xl font-black leading-tight text-white drop-shadow-[0_0_14px_rgba(217,70,239,0.55)] sm:text-3xl">{formatTarget(signal.deltaTarget!)}</p>
                {reliabilityBadge("ASSERTIVIDADE DO EIXO DELTA", secondaryReliability!)}
              </div>
              <p className={`rounded-xl border px-4 py-3 text-sm font-bold leading-relaxed ${signal.blocked ? "border-rose-400/50 bg-rose-500/10 text-rose-200" : "border-white/10 bg-white/5 text-white"}`}>{signal.blocked ? "🚫 GALE 1 BLOQUEADO — Inércia contrária forte detetada. Proteja a banca e aguarde o próximo ciclo." : signal.action}</p>
            </div>
          ) : (
            <>
              <div className="mt-5 rounded-2xl border border-cyan-300/60 bg-gradient-to-br from-cyan-400/15 via-blue-500/10 to-fuchsia-500/15 px-4 py-5 shadow-[0_0_38px_rgba(34,211,238,0.16)] ring-1 ring-white/10 sm:px-5">
                <p className="text-xs font-black tracking-[0.24em] text-lime-200">ALVO IDENTIFICADO</p>
                <p className="mt-2 break-words text-3xl font-black leading-tight text-white drop-shadow-[0_0_15px_rgba(34,211,238,0.65)] sm:text-4xl">{formatTarget(signal.target)}</p>
                <p className={`mt-4 text-sm font-bold leading-relaxed ${signal.blocked ? "text-rose-200" : "text-white"}`}>{signal.blocked ? "🚫 GALE 1 BLOQUEADO — Inércia contrária forte detetada. Proteja a banca e aguarde o próximo ciclo." : signal.action}</p>
              </div>
              {reliabilityBadge(signal.strategy.toUpperCase(), primaryReliability)}
            </>
          )}

          {secondarySignals.length > 0 && (
            <div className="mt-4 space-y-2">
              {secondarySignals.map((secondary) => (
                <div key={secondary.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-500/40 bg-slate-800/70 px-3 py-2 text-xs">
                  <span className="font-black text-slate-100">{secondary.name} • {secondary.target}</span>
                  <span className="rounded-full bg-slate-600/40 px-2 py-1 font-bold text-slate-200">{secondary.tagVisual ?? "🛡️ SINAL SECUNDÁRIO / COBERTURA"} • WR {secondary.winRate ?? `${(calibrationWeight[secondary.strategy] * 100).toFixed(1)}%`}</span>
                </div>
              ))}
            </div>
          )}
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
