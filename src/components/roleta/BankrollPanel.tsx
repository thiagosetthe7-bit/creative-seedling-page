import { useEffect, useState } from "react";
import { CheckCircle2, ShieldAlert, Wallet } from "lucide-react";
import { BankrollEquityDashboard } from "@/components/roleta/BankrollEquityDashboard";
import { BANKROLL_KEY, carregarConfigBanca, diaAtivo, dinheiro, DEFAULT_BANKROLL_CONFIG, type BankrollConfig } from "@/lib/roleta/bankroll";

const inputClass = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-emerald-500";
const dataLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
export function BankrollPanel() {
  const [config, setConfig] = useState<BankrollConfig>(() => carregarConfigBanca());
  const today = dataLocal();
  const activeDay = Math.max(1, diaAtivo(config, today));
  const activeBank = config.dataResetDia === today && typeof config.bancaResetDia === "number" ? config.bancaResetDia : config.bancaInicial;
  const currentBank = activeBank;
  const dailyTarget = config.metaModo === "valor" ? config.metaValor : activeBank * config.metaDiariaPercentual / 100;
  const stopLoss = activeBank * config.stopLossPercentual / 100;
  useEffect(() => { try { window.localStorage.setItem(BANKROLL_KEY, JSON.stringify(config)); } catch { /* storage opcional */ } }, [config]);
  const update = (patch: Partial<BankrollConfig>) => setConfig((current) => ({ ...current, ...patch }));
  const resetNovoDia = () => update({ dataResetDia: today, resetTimestamp: Date.now(), bancaResetDia: currentBank });
  const resetTotal = () => {
    if (!window.confirm("Resetar as configurações da banca para o Dia 1, com R$ 100,00?")) return;
    setConfig({ ...DEFAULT_BANKROLL_CONFIG, bancaInicial: 100, dataInicio: today });
  };
  return <div className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-lg font-black tracking-widest">GERENCIAMENTO DE BANCA</h1><div className="flex gap-2"><button type="button" onClick={resetNovoDia} className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-black text-amber-500">ZERAR / NOVO DIA</button><button type="button" onClick={resetTotal} className="rounded-lg border border-rose-500/50 bg-rose-500 px-4 py-2 text-xs font-black text-white">RESETAR BANCA PARA O DIA 1 (R$ 100,00)</button></div></header>
    <BankrollEquityDashboard config={config}/>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric title="BANCA ATUAL" value={dinheiro(currentBank)} icon={<Wallet className="h-4 w-4"/>}/>
      <Metric title="BANCA DO DIA ATIVO" value={dinheiro(activeBank)} icon={<Wallet className="h-4 w-4"/>}/>
      <Metric title="DIA DA OPERAÇÃO" value={`DIA ${activeDay}`}/>
      <Metric title="RESULTADO REGISTRADO DO DIA" value={dinheiro(0)} tone="green"/>
      <Metric title="META DIÁRIA" value={dinheiro(dailyTarget)}/>
    </section>
    <section className="rounded-xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-sm font-black text-emerald-500"><CheckCircle2 className="h-5 w-5"/> CONTROLE FINANCEIRO DISPONÍVEL</div><p className="mt-2 text-xs text-muted-foreground">Os motores e o histórico de estratégias foram removidos. O saldo só será alterado por um módulo de lançamentos financeiros independente, caso seja adicionado futuramente.</p></section>
    <section className="rounded-xl border border-border bg-card p-4"><h2 className="mb-4 text-sm font-black tracking-widest">PARÂMETROS DA BANCA</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Field label="Banca Inicial (R$)"><input className={inputClass} type="number" min="0" step="0.01" value={config.bancaInicial} onChange={(e) => update({ bancaInicial: Math.max(0, Number(e.target.value)) })}/></Field>
      <Field label="Tipo de meta"><select className={inputClass} value={config.metaModo} onChange={(e) => update({ metaModo: e.target.value as BankrollConfig["metaModo"] })}><option value="valor">Valor em R$</option><option value="percentual">Percentual</option></select></Field>
      {config.metaModo === "valor" ? <Field label="Meta diária (R$)"><input className={inputClass} type="number" min="0" step="0.01" value={config.metaValor} onChange={(e) => update({ metaValor: Math.max(0, Number(e.target.value)) })}/></Field> : <Field label="Meta diária (%)"><input className={inputClass} type="number" min="0" step="0.1" value={config.metaDiariaPercentual} onChange={(e) => update({ metaDiariaPercentual: Math.max(0, Number(e.target.value)), metaPercentual: Math.max(0, Number(e.target.value)) })}/></Field>}
      <Field label="Data inicial"><input className={inputClass} type="date" value={config.dataInicio} onChange={(e) => update({ dataInicio: e.target.value || today })}/></Field>
      <Field label="Stop Loss diário (%)"><input className={inputClass} type="number" min="0" step="0.1" value={config.stopLossPercentual} onChange={(e) => update({ stopLossPercentual: Math.max(0, Number(e.target.value)) })}/></Field>
    </div><p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><ShieldAlert className="h-4 w-4"/> Limite de perda configurado: {dinheiro(stopLoss)}. Não há operações de estratégia ativas.</p></section>
  </div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-bold">{label}{children}</label>; }
function Metric({ title, value, icon, tone }: { title: string; value: string; icon?: React.ReactNode; tone?: "green" | "red" }) { return <div className="rounded-xl border border-border bg-card p-4"><p className="flex items-center gap-2 text-[10px] font-black tracking-widest text-muted-foreground">{icon}{title}</p><p className={`mt-2 text-xl font-black ${tone === "green" ? "text-emerald-500" : tone === "red" ? "text-rose-500" : ""}`}>{value}</p></div>; }
