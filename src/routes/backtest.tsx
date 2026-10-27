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
  const [records, setRecords] = useState<Array<{ number: number; time: string; timestamp: number }> | null>(null);
  const [error, setError] = useState("");
  const results = useMemo(() => {
    if (!records?.length) return null;
    const spins = records.map((record) => criarSpin(record.number, record.timestamp));
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
  }, [records]);

  const run = () => {
    const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) {
      setError("Cole os números e seus horários, um item por linha: primeiro o número e, na linha seguinte, o horário HH:MM.");
      setRecords(null);
      return;
    }
    if (lines.length % 2 !== 0) {
      setError("O histórico está incompleto: cada número precisa ser seguido pelo horário HH:MM na linha seguinte.");
      setRecords(null);
      return;
    }
    const parsed: Array<{ number: number; time: string; minutes: number; sourceIndex: number; timestamp: number }> = [];
    for (let i = 0; i < lines.length; i += 2) {
      const numberLine = lines[i] ?? "";
      const timeLine = lines[i + 1] ?? "";
      if (!/^\d{1,2}$/.test(numberLine)) {
        setError(`Linha ${i + 1}: esperado um número inteiro de 0 a 36, mas foi encontrado "${numberLine}".`);
        setRecords(null);
        return;
      }
      const number = Number(numberLine);
      if (number < 0 || number > 36) {
        setError(`Linha ${i + 1}: o número deve estar entre 0 e 36.`);
        setRecords(null);
        return;
      }
      const match = /^(?:([01]\d|2[0-3])):([0-5]\d)$/.exec(timeLine);
      if (!match) {
        setError(`Linha ${i + 2}: horário inválido ("${timeLine}"). Use o formato HH:MM, por exemplo 09:42.`);
        setRecords(null);
        return;
      }
      parsed.push({ number, time: timeLine, minutes: Number(match[1]) * 60 + Number(match[2]), sourceIndex: i / 2, timestamp: 0 });
    }
    if (parsed.length > 100) {
      setError("O limite desta análise é de 100 pares número + horário por importação.");
      setRecords(null);
      return;
    }

    // A origem normalmente vem do mais recente para o mais antigo. Ao caminhar
    // nessa ordem, um aumento de horário indica que cruzamos a meia-noite para trás.
    let dayOffset = 0;
    let previousMinutes: number | null = null;
    for (const record of parsed) {
      if (previousMinutes !== null && record.minutes > previousMinutes) dayOffset -= 1;
      record.timestamp = (dayOffset * 1440 + record.minutes) * 60_000;
      previousMinutes = record.minutes;
    }
    const chronological = parsed
      .sort((a, b) => a.timestamp - b.timestamp || a.sourceIndex - b.sourceIndex)
      .map(({ number, time, timestamp }) => ({ number, time, timestamp }));
    setError("");
    setRecords(chronological);
  };

  return <AppShell>
    <div className="mx-auto max-w-5xl space-y-5">
      <header><p className="text-xs font-black tracking-[0.2em] text-amber-500">ANÁLISE RETROSPECTIVA</p><h1 className="mt-1 text-xl font-black tracking-widest">IMPORTAÇÃO DE HISTÓRICO · BACKTEST PREVENTIVO</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Cole até 100 resultados anteriores. A análise reproduz as regras de sinal atuais sobre a sequência informada; resultados passados não predizem giros futuros.</p></header>
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <label htmlFor="history-numbers" className="block text-sm font-bold">Histórico da roleta: número e horário em linhas alternadas</label>
        <textarea id="history-numbers" value={input} onChange={(event) => setInput(event.target.value)} rows={5} placeholder={"12\n18:42\n7\n18:41\n0\n18:40\n24\n18:39"} className="w-full rounded-lg border border-border bg-background p-3 font-mono text-sm outline-none focus:border-amber-400" />
        <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={run} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-black text-black hover:bg-amber-300">PROCESSAR HISTÓRICO</button><button type="button" onClick={() => { setInput(""); setRecords(null); setError(""); }} className="rounded-lg border border-border px-4 py-2 text-sm font-bold">LIMPAR</button><span className="text-xs text-muted-foreground">Máximo: 100 pares número + horário · {input.trim() ? Math.ceil(input.split(/\r?\n/).filter((line) => line.trim()).length / 2) : 0}/100 pares</span></div>
        {error && <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm font-bold text-rose-500">{error}</p>}
      </section>
      {records && <section className="rounded-xl border border-sky-500/40 bg-sky-500/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="text-sm font-black tracking-widest">HISTÓRICO VALIDADO E ORDENADO</h2><p className="mt-1 text-xs text-muted-foreground">A simulação usa a ordem cronológica, do giro mais antigo ao mais recente.</p></div>
          <span className="rounded-full border border-sky-500/40 px-3 py-1 text-xs font-bold">{records.length} pares válidos</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {records.map((record, index) => <span key={index} className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs">{record.number} <span className="text-muted-foreground">{record.time}</span></span>)}
        </div>
      </section>}
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
