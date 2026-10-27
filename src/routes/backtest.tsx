import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/roleta/AppShell";
import { criarSpin } from "@/lib/roleta/catalogo";
import { rebuildSignalTracking } from "@/lib/roleta/signalTracking";

export const Route = createFileRoute("/backtest")({
  head: () => ({ meta: [{ title: "Importação de Histórico — Backtest" }, { name: "description", content: "Teste retrospectivo de sinais sobre giros informados manualmente." }] }),
  component: Backtest,
});

function Backtest() {
  const [input, setInput] = useState("");
  const [numbers, setNumbers] = useState<number[] | null>(null);
  const [error, setError] = useState("");
  const results = useMemo(() => {
    if (!numbers?.length) return null;
    const spins = numbers.map((number, index) => criarSpin(number, 1_700_000_000_000 + index * 60_000));
    const tracking = rebuildSignalTracking(spins, {}, true);
    const resolved = tracking.signals.filter((signal) => signal.status === "CONCLUÍDO" && ["GREEN_R1", "GREEN_GALE1", "RED"].includes(signal.result));
    const greenR1 = resolved.filter((signal) => signal.result === "GREEN_R1").length;
    const greenR2 = resolved.filter((signal) => signal.result === "GREEN_GALE1").length;
    const reds = resolved.filter((signal) => signal.result === "RED").length;
    const greens = greenR1 + greenR2;
    const totalResolved = resolved.length;
    const winRate = totalResolved ? greens / totalResolved * 100 : 0;
    const verdict = totalResolved >= 3 && greens > reds ? "Ciclo Favorável" : "Ciclo de Armadilha/Exaustão";
    return { totalSignals: tracking.signals.length, totalResolved, greenR1, greenR2, reds, greens, winRate, verdict };
  }, [numbers]);

  const run = () => {
    const tokens = input.trim().split(/[\s,;|]+/).filter(Boolean);
    if (!tokens.length) { setError("Cole os números separados por espaço, vírgula ou quebra de linha."); setNumbers(null); return; }
    if (tokens.length > 100) { setError("O limite desta análise é de 100 números por importação."); setNumbers(null); return; }
    const parsed = tokens.map((token) => /^\d{1,2}$/.test(token) ? Number(token) : NaN);
    if (parsed.some((number) => !Number.isInteger(number) || number < 0 || number > 36)) { setError("Use somente números inteiros de 0 a 36. Confira o histórico e tente novamente."); setNumbers(null); return; }
    setError("");
    setNumbers(parsed);
  };

  return <AppShell>
    <div className="mx-auto max-w-5xl space-y-5">
      <header><p className="text-xs font-black tracking-[0.2em] text-amber-500">ANÁLISE RETROSPECTIVA</p><h1 className="mt-1 text-xl font-black tracking-widest">IMPORTAÇÃO DE HISTÓRICO · BACKTEST PREVENTIVO</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Cole até 100 resultados anteriores. A análise reproduz as regras de sinal atuais sobre a sequência informada; resultados passados não predizem giros futuros.</p></header>
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <label htmlFor="history-numbers" className="block text-sm font-bold">Últimos números da roleta (0–36)</label>
        <textarea id="history-numbers" value={input} onChange={(event) => setInput(event.target.value)} rows={5} placeholder="Ex.: 12, 7, 0, 24, 18, 33..." className="w-full rounded-lg border border-border bg-background p-3 font-mono text-sm outline-none focus:border-amber-400" />
        <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={run} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-black text-black hover:bg-amber-300">PROCESSAR HISTÓRICO</button><button type="button" onClick={() => { setInput(""); setNumbers(null); setError(""); }} className="rounded-lg border border-border px-4 py-2 text-sm font-bold">LIMPAR</button><span className="text-xs text-muted-foreground">Máximo: 100 giros · {input.trim() ? input.trim().split(/[\s,;|]+/).filter(Boolean).length : 0}/100</span></div>
        {error && <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm font-bold text-rose-500">{error}</p>}
      </section>
      {results && <section className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="SINAIS DISPARADOS" value={String(results.totalSignals)} />
          <Metric label="WIN RATE" value={results.totalResolved ? results.winRate.toFixed(1).replace(".", ",") + "%" : "—"} />
          <Metric label="GREENS R1" value={String(results.greenR1)} tone="green" />
          <Metric label="GREENS R2" value={String(results.greenR2)} tone="green" />
          <Metric label="REDS CONFIRMADOS R2" value={String(results.reds)} tone="red" />
          <Metric label="RESULTADOS RESOLVIDOS" value={String(results.totalResolved)} />
        </div>
        <div className={results.verdict === "Ciclo Favorável" ? "rounded-xl border-2 border-emerald-500 bg-emerald-500/10 p-5" : "rounded-xl border-2 border-amber-500 bg-amber-500/10 p-5"}>
          <p className="text-xs font-black tracking-widest">VEREDITO DESCRITIVO DA AMOSTRA</p><h2 className="mt-2 text-2xl font-black">{results.verdict}</h2><p className="mt-2 text-sm text-muted-foreground">Base: {results.totalResolved} sinais resolvidos; {results.greens} greens (R1 + R2) e {results.reds} reds confirmados no R2. {results.totalResolved < 3 ? "Amostra pequena: o veredito é provisório e pouco informativo." : "O veredito descreve apenas a sequência importada, não oferece garantia de desempenho futuro."}</p>
        </div>
      </section>}
    </div>
  </AppShell>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" }) {
  return <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs font-black tracking-wide text-muted-foreground">{label}</p><p className={`mt-2 text-2xl font-black ${tone === "green" ? "text-emerald-500" : tone === "red" ? "text-rose-500" : ""}`}>{value}</p></div>;
}
