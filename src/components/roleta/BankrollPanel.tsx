import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ShieldAlert, Wallet } from "lucide-react";
import { BankrollEquityDashboard } from "@/components/roleta/BankrollEquityDashboard";
import { useSinais } from "@/lib/roleta/useSinais";
import type { TrackedSignal } from "@/lib/roleta/signalTracking";
import { useEstado } from "@/lib/roleta/store";
import { effectiveSignalResult, impactoFinanceiro, loadSessionFinance, SESSION_FINANCE_EVENT } from "@/lib/roleta/sessionFinance";
import { BANKROLL_KEY, carregarConfigBanca, calcularBanca, diaAtivo, dinheiro, type BankrollConfig } from "@/lib/roleta/bankroll";

const inputClass = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-amber-400";
const dataLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };

export function BankrollPanel() {
  const { tracking } = useSinais();
  const estado = useEstado();
  const [financeRevision, setFinanceRevision] = useState(0);
  useEffect(() => { const sync = () => setFinanceRevision((n) => n + 1); window.addEventListener(SESSION_FINANCE_EVENT, sync); window.addEventListener("storage", sync); return () => { window.removeEventListener(SESSION_FINANCE_EVENT, sync); window.removeEventListener("storage", sync); }; }, []);
  void financeRevision;
  const [config, setConfig] = useState<BankrollConfig>(() => carregarConfigBanca());
  const [alertaDispensado, setAlertaDispensado] = useState(false);
  const financeLedger = loadSessionFinance();
  const spinById = useMemo(() => new Map(estado.spins.map((spin) => [spin.id, spin] as const)), [estado.spins]);
  const autoDailyResults = useMemo(() => { const totals: Record<number, number> = { ...(financeLedger.archivedDailyResults ?? {}) }; for (const signal of tracking.signals) { if (!signal.resultSpinId) continue; const result = effectiveSignalResult(signal, financeLedger); if (result === "PENDING" || result === "NO_SIGNAL" || result === "NOT_PICKED") continue; if (financeLedger.removedSignalIds.includes(signal.id)) continue; const spin = spinById.get(signal.resultSpinId) ?? spinById.get(signal.sourceSpinId); if (!spin) continue; const d = new Date(spin.timestamp); const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; const day = diaAtivo(config, date); if (day < 1) continue; const impact = financeLedger.financialOverrides?.[signal.id] ?? impactoFinanceiro(signal, config, financeLedger); if (impact !== null) totals[day] = (totals[day] ?? 0) + impact; } return totals; }, [tracking.signals, financeLedger, spinById, config]);
  const financialSignals = tracking.signals.filter((signal) => !financeLedger.removedSignalIds.includes(signal.id)).map((signal) => { const result = effectiveSignalResult(signal, financeLedger); return { ...signal, status: result === "PENDING" ? signal.status : "CONCLUÍDO" as const, result: result === "PENDING" ? "NO_SIGNAL" as const : result as TrackedSignal["result"] }; });
  const activeDay = Math.max(1, diaAtivo(config, dataLocal()));
  const previousDaysResult = Object.entries(autoDailyResults).reduce((sum, [day, value]) => Number(day) < activeDay ? sum + value : sum, 0);
  const activeBank = Math.max(0, config.bancaInicial + previousDaysResult);
  const resultadoDia = autoDailyResults[activeDay] ?? 0;
  const metaDia = config.metaModo === "valor" ? Math.max(0, config.metaValor) : Math.max(0, activeBank * config.metaDiariaPercentual / 100);
  const metaDiaBatida = resultadoDia >= metaDia && metaDia > 0;
  const stopLossAtivo = Math.max(0, activeBank) * (config.stopLossPercentual ?? 20) / 100;
  const bancaAtual = Math.max(0, activeBank + resultadoDia);
  const progressoMeta = metaDia > 0 ? Math.max(0, Math.min(100, resultadoDia / metaDia * 100)) : 0;
  const progressoStopLoss = stopLossAtivo > 0 ? Math.max(0, Math.min(100, Math.abs(Math.min(0, resultadoDia)) / stopLossAtivo * 100)) : 0;
  const progressoOperacional = resultadoDia >= 0 ? progressoMeta : progressoStopLoss;
  const resumoBase = useMemo(() => calcularBanca(financialSignals, config), [financialSignals, config]);
  const resumo = { ...resumoBase, stopLossCritico: resultadoDia <= -stopLossAtivo && stopLossAtivo > 0 };

  useEffect(() => { try { window.localStorage.setItem(BANKROLL_KEY, JSON.stringify(config)); } catch { /* storage opcional */ } }, [config]);
  useEffect(() => { setAlertaDispensado(false); }, [metaDiaBatida]);

  const update = (patch: Partial<BankrollConfig>) => setConfig((current) => ({ ...current, ...patch }));
  const blockSignals = config.bloquearSinaisMetaDiaria && metaDiaBatida;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-black tracking-widest">GERENCIAMENTO DE BANCA</h1>
      </header>

      {blockSignals && <div role="alert" className="rounded-xl border-2 border-emerald-500 bg-emerald-500/10 p-4 font-black text-emerald-500">SINAIS BLOQUEADOS: META DIÁRIA ALCANÇADA. A opção de proteção de lucro está ativa.</div>}
      {!alertaDispensado && metaDiaBatida && <div role="alert" aria-live="assertive" className="rounded-xl border-2 border-emerald-500 bg-emerald-500/10 p-5"><div className="flex items-start gap-3"><CheckCircle2 className="h-7 w-7 text-emerald-500"/><div className="flex-1"><h2 className="text-xl font-black text-emerald-500">META DIÁRIA ALCANÇADA</h2><p className="mt-1 text-sm">Resultado registrado: {dinheiro(resultadoDia)} · Meta do dia: {dinheiro(metaDia)}.</p></div><button onClick={() => setAlertaDispensado(true)} className="rounded border border-border px-3 py-1 text-xs">FECHAR</button></div></div>}
      {!alertaDispensado && resumo.stopLossCritico && <div role="alert" className="rounded-xl border-2 border-rose-500 bg-rose-500/10 p-4 font-black text-rose-500"><ShieldAlert className="mr-2 inline h-5 w-5"/>STOP LOSS CRÍTICO: o limite financeiro da sessão foi atingido.</div>}
      <section className={resumo.stopLossCritico ? "rounded-xl border-2 border-rose-500 bg-rose-500/10 p-4" : Math.max(0, -resultadoDia) >= stopLossAtivo * 0.5 ? "rounded-xl border-2 border-amber-500 bg-amber-500/10 p-4" : "rounded-xl border-2 border-emerald-500 bg-emerald-500/10 p-4"}>
        <p className="text-xs font-black tracking-widest">STATUS DE RISCO DA BANCA</p>
        {resumo.stopLossCritico ? <p className="mt-1 font-black text-rose-500">🔴 STOP LOSS ATINGIDO — confirmado após RED no R2.</p> : Math.max(0, -resultadoDia) >= stopLossAtivo * 0.5 ? <p className="mt-1 font-black text-amber-500">🟡 CRÍTICO — Situação Crítica: Alto risco de Stop Loss.</p> : <p className="mt-1 font-black text-emerald-500">🟢 ESTÁVEL — perda abaixo de 50% do limite de Stop Loss.</p>}
        <p className="mt-1 text-xs text-muted-foreground">Limite dinâmico do dia: {dinheiro(stopLossAtivo)} (20% de {dinheiro(activeBank)}). O Stop Loss não bloqueia a indicação Smart Gale 1; só é marcado como atingido após RED confirmado no R2.</p>
      </section>

      <BankrollEquityDashboard signals={tracking.signals} config={config} ledger={financeLedger} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="BANCA ATUAL" value={dinheiro(bancaAtual)} icon={<Wallet className="h-4 w-4"/>}/>
        <Metric title="BANCA DO DIA ATIVO" value={dinheiro(activeBank)} icon={<Wallet className="h-4 w-4"/>}/>
        <Metric title="DIA DA OPERAÇÃO" value={`DIA ${activeDay}`}/>
        <Metric title="RESULTADO REALIZADO DO DIA" value={dinheiro(resultadoDia)} tone={resultadoDia >= 0 ? "green" : "red"}/>
        <Metric title="META DIÁRIA" value={dinheiro(metaDia)}/>
      </section>

      <section className="rounded-xl border border-border bg-card p-4" aria-label="Progresso da meta e proteção diária">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-black tracking-widest">PROGRESSO DA META DIÁRIA</h2><strong className={resultadoDia < 0 ? "text-rose-400" : "text-emerald-400"}>{resultadoDia < 0 ? `STOP LOSS: ${progressoStopLoss.toFixed(1)}%` : `META: ${progressoMeta.toFixed(1)}%`}</strong></div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted"><div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressoOperacional} className={`h-full rounded-full transition-all ${resultadoDia < 0 ? "bg-rose-500" : metaDiaBatida ? "bg-emerald-400" : "bg-cyan-400"}`} style={{ width: `${progressoOperacional}%` }}/></div>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>Resultado do dia: {dinheiro(resultadoDia)}</span><span>{resultadoDia < 0 ? `Limite de perda: ${dinheiro(stopLossAtivo)}` : `Meta: ${dinheiro(metaDia)}`}</span></div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-4 text-sm font-black tracking-widest">PARÂMETROS EDITÁVEIS</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Banca Inicial (R$)"><input className={inputClass} type="number" min="0" step="any" value={config.bancaInicial} onChange={(e) => update({ bancaInicial: Math.max(0, Number(e.target.value)) })}/></Field>
          <Field label="Tipo de meta diária"><select className={inputClass} value={config.metaModo} onChange={(e) => update({ metaModo: e.target.value as "valor" | "percentual" })}><option value="valor">Meta em R$</option><option value="percentual">Meta em %</option></select></Field>
          {config.metaModo === "valor" ? <Field label="Meta Diária (R$)"><input className={inputClass} type="number" min="0" step="any" value={config.metaValor} onChange={(e) => update({ metaValor: Math.max(0, Number(e.target.value)) })}/></Field> : <Field label="Meta Diária (%)"><input className={inputClass} type="number" min="0" step="0.1" value={config.metaDiariaPercentual} onChange={(e) => update({ metaDiariaPercentual: Math.max(0, Number(e.target.value)), metaPercentual: Math.max(0, Number(e.target.value)) })}/></Field>}
          <Field label="Data inicial da operação"><input className={inputClass} type="date" value={config.dataInicio} onChange={(e) => update({ dataInicio: e.target.value || dataLocal() })}/></Field>
          <Field label="Stake Base R1 por Área (R$)"><input className={inputClass} type="number" min="0" step="0.5" value={config.stakeR1PorArea} onChange={(e) => update({ stakeR1PorArea: Math.max(0, Number(e.target.value)), stakeR2PorArea: Math.max(0, Number(e.target.value)) * 2 })}/></Field>
          <Field label="Stop Loss dinâmico (20% da banca do dia)"><div className={inputClass + " bg-muted/40"} aria-live="polite">{dinheiro(stopLossAtivo)}</div></Field>
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3"><input type="checkbox" className="mt-1" checked={config.bloquearSinaisMetaDiaria} onChange={(e) => update({ bloquearSinaisMetaDiaria: e.target.checked })}/><span><strong className="block text-sm">Bloquear novos sinais ao atingir a meta diária</strong><span className="text-xs text-muted-foreground">Quando ativado, a catalogação oculta o popup de entrada após registrar resultado diário igual ou superior à meta.</span></span></label>
      </section>




    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-bold">{label}{children}</label>; }
function Metric({ title, value, icon, tone }: { title: string; value: string; icon?: React.ReactNode; tone?: "green" | "red" }) { return <div className="rounded-xl border border-border bg-card p-4"><p className="flex items-center gap-2 text-[10px] font-black tracking-widest text-muted-foreground">{icon}{title}</p><p className={`mt-2 text-xl font-black ${tone === "green" ? "text-emerald-500" : tone === "red" ? "text-rose-500" : ""}`}>{value}</p></div>; }
