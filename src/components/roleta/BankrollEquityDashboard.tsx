import { useEffect, useState } from "react";
import { TrendingUp, Wallet } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrackedSignal } from "@/lib/roleta/signalTracking";
import type { BankrollConfig } from "@/lib/roleta/bankroll";
import { dinheiro } from "@/lib/roleta/bankroll";
import { effectiveSignalResult, impactoFinanceiro, type SessionFinanceLedger } from "@/lib/roleta/sessionFinance";

const EQUITY_CURVE_KEY = "roleta-bankroll-equity-v1";
type EquityPoint = { id: string; label: string; bankroll: number; impact: number; status: string; openingBankroll: number };
function readPoints(): EquityPoint[] {
  if (typeof window === "undefined") return [];
  try { const value = JSON.parse(window.localStorage.getItem(EQUITY_CURVE_KEY) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; }
}

export function BankrollEquityDashboard({ signals, config, ledger }: { signals: TrackedSignal[]; config: BankrollConfig; ledger: SessionFinanceLedger }) {
  const [points, setPoints] = useState<EquityPoint[]>(readPoints);
  const signature = JSON.stringify({ signals, config, ledger });
  useEffect(() => {
    const all = [...(ledger.archivedSignals ?? []), ...signals];
    const unique = [...new Map(all.map((signal) => [signal.id, signal])).values()];
    const removed = new Set(ledger.removedSignalIds);
    let next = readPoints().filter((point) => point.id === "__initial__" || point.id === "__archive__" || !removed.has(point.id));
    const opening = next.find((point) => point.id === "__initial__")?.openingBankroll ?? config.bancaInicial;
    if (!next.length) next = [{ id: "__initial__", label: "Início", bankroll: opening, impact: 0, status: "Banca inicial", openingBankroll: opening }];
    if (!(ledger.archivedSignals?.length) && !unique.length && ledger.archivedDailyResults) {
      const archived = Object.values(ledger.archivedDailyResults).reduce((sum, value) => sum + Number(value || 0), 0);
      if (archived !== 0 && !next.some((point) => point.id === "__archive__")) next.push({ id: "__archive__", label: "Resultado anterior", bankroll: opening + archived, impact: archived, status: "Histórico anterior", openingBankroll: opening });
    }
    const resolved = unique.filter((signal) => {
      const result = effectiveSignalResult(signal, ledger);
      return result !== "PENDING" && result !== "NO_SIGNAL" && !removed.has(signal.id);
    }).sort((a, b) => a.sourceIndex - b.sourceIndex);
    for (const signal of resolved) {
      const result = effectiveSignalResult(signal, ledger);
      const impact = result === "NOT_PICKED" || result === "BLOCKED" || result === "GALE_BLOCKED" ? 0
        : ledger.financialOverrides?.[signal.id] !== undefined ? ledger.financialOverrides[signal.id]!
        : impactoFinanceiro(signal, config, ledger) ?? 0;
      const point: EquityPoint = { id: signal.id, label: "Entrada #" + signal.sourceIndex, bankroll: 0, impact, status: String(result), openingBankroll: opening };
      const existing = next.findIndex((item) => item.id === signal.id);
      if (existing >= 0) next[existing] = point; else next.push(point);
    }
    let balance = opening;
    next = next.map((point) => {
      if (point.id === "__initial__") return { ...point, bankroll: opening, openingBankroll: opening };
      balance += point.impact;
      return { ...point, bankroll: balance, openingBankroll: opening };
    });
    try { window.localStorage.setItem(EQUITY_CURVE_KEY, JSON.stringify(next)); } catch { /* storage opcional */ }
    setPoints(next);
  // signature serializes all inputs so edits to a status or financial override recalculate the curve.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const initial = points[0]?.openingBankroll ?? config.bancaInicial;
  const current = points.at(-1)?.bankroll ?? initial;
  const peak = Math.max(initial, ...points.map((point) => point.bankroll));
  const result = current - initial;
  const percent = initial > 0 ? result / initial * 100 : 0;
  const chartData = points.length ? points : [{ id: "__initial__", label: "Início", bankroll: initial, impact: 0, status: "Banca inicial", openingBankroll: initial }];
  const metric = (title: string, value: string, tone = "") => <div className="rounded-xl border border-border bg-background/60 p-4"><p className="text-[10px] font-black tracking-widest text-muted-foreground">{title}</p><p className={"mt-2 text-xl font-black " + tone}>{value}</p></div>;

  return <section className="space-y-4 rounded-xl border border-border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="flex items-center gap-2 text-sm font-black tracking-widest"><TrendingUp className="h-4 w-4 text-emerald-500"/> EVOLUÇÃO GRADUAL DA BANCA</h2><p className="mt-1 text-xs text-muted-foreground">Cada entrada finalizada adiciona um ponto. O histórico permanece salvo entre sessões.</p></div><span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-black text-emerald-400">{Math.max(0, points.length - 1)} REGISTROS</span></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metric("BANCA INICIAL", dinheiro(initial), "text-foreground")}
      {metric("BANCA ATUAL", dinheiro(current), "text-foreground")}
      {metric("MAIOR SALDO ATINGIDO (PICO)", dinheiro(peak), "text-emerald-500")}
      {metric("RESULTADO ACUMULADO", (result > 0 ? "+" : result < 0 ? "−" : "") + dinheiro(Math.abs(result)) + " · " + (percent >= 0 ? "+" : "") + percent.toFixed(2) + "%", result >= 0 ? "text-emerald-500" : "text-rose-500")}
    </div>
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
          <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={24}/>
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => "R$ " + Number(value).toFixed(0)} width={76}/>
          <Tooltip formatter={(value) => [dinheiro(Number(value)), "Saldo acumulado"]} labelFormatter={(label) => String(label)}/>
          <Line type="monotone" dataKey="bankroll" name="Banca" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  </section>;
}
