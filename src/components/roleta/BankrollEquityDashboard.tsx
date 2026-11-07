import { TrendingUp, Wallet } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BankrollConfig } from "@/lib/roleta/bankroll";
import { dinheiro } from "@/lib/roleta/bankroll";

export function BankrollEquityDashboard({ config }: { config: BankrollConfig }) {
  const initial = config.bancaInicial;
  const current = config.dataResetDia === new Date().toISOString().slice(0, 10) && typeof config.bancaResetDia === "number" ? config.bancaResetDia : initial;
  const chartData = [{ label: "Banca atual", bankroll: current }];
  const metric = (title: string, value: string) => <div className="rounded-xl border border-border bg-background/60 p-4"><p className="text-[10px] font-black tracking-widest text-muted-foreground">{title}</p><p className="mt-2 text-xl font-black">{value}</p></div>;
  return <section className="space-y-4 rounded-xl border border-border bg-card p-4">
    <div><h2 className="flex items-center gap-2 text-sm font-black tracking-widest"><TrendingUp className="h-4 w-4 text-emerald-500"/> EVOLUÇÃO DA BANCA</h2><p className="mt-1 text-xs text-muted-foreground">A curva será formada quando forem registrados lançamentos financeiros independentes da catalogação.</p></div>
    <div className="grid gap-3 sm:grid-cols-3">{metric("BANCA INICIAL", dinheiro(initial))}{metric("BANCA ATUAL", dinheiro(current))}{metric("RESULTADO REGISTRADO", dinheiro(current - initial))}</div>
    <div className="h-[240px] w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis dataKey="label"/><YAxis tickFormatter={(v) => "R$ " + Number(v).toFixed(0)}/><Tooltip formatter={(v) => [dinheiro(Number(v)), "Saldo"]}/><Line type="monotone" dataKey="bankroll" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }}/></LineChart></ResponsiveContainer></div>
  </section>;
}
