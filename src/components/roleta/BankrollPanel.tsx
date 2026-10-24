import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert, Wallet } from "lucide-react";
import { useSinais } from "@/lib/roleta/useSinais";
import { BANKROLL_KEY, BANKROLL_DAYS_KEY, carregarConfigBanca, carregarDiasBanca, calcularBanca, calcularTabelaJuros, projetarJurosCompostos, diaAtivo, dinheiro, DEFAULT_BANKROLL_CONFIG, type BankrollConfig, type DailyRecord } from "@/lib/roleta/bankroll";

const inputClass = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-amber-400";
const dataLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };

export function BankrollPanel() {
  const { tracking } = useSinais();
  const [config, setConfig] = useState<BankrollConfig>(() => carregarConfigBanca());
  const [records, setRecords] = useState<Record<number, DailyRecord>>(() => carregarDiasBanca());
  const [alertaDispensado, setAlertaDispensado] = useState(false);
  const [confirmarReset, setConfirmarReset] = useState(false);
  const rows = useMemo(() => calcularTabelaJuros(config, records, dataLocal()), [config, records]);
  const resumo = useMemo(() => calcularBanca(tracking.signals, config), [tracking.signals, config]);
  const activeDay = Math.max(1, Math.min(config.periodoDias, diaAtivo(config, dataLocal())));
  const activeRow = rows[activeDay - 1];
  const resultadoDia = activeRow?.resultadoRealizado ?? 0;
  const metaDiaBatida = Boolean(activeRow && resultadoDia >= activeRow.metaDia && activeRow.resultadoRealizado !== null);
  const projecaoFinal = projetarJurosCompostos(config.bancaInicial, config.metaDiariaPercentual, config.periodoDias);

  useEffect(() => { try { window.localStorage.setItem(BANKROLL_KEY, JSON.stringify(config)); } catch { /* storage opcional */ } }, [config]);
  useEffect(() => { try { window.localStorage.setItem(BANKROLL_DAYS_KEY, JSON.stringify(records)); } catch { /* storage opcional */ } }, [records]);
  useEffect(() => { setAlertaDispensado(false); }, [metaDiaBatida]);

  const update = (patch: Partial<BankrollConfig>) => setConfig((current) => ({ ...current, ...patch }));
  const updateResult = (day: number, value: string) => setRecords((current) => ({ ...current, [day]: { ...current[day], resultadoRealizado: value.trim() === "" ? null : Number(value) } }));
  const updateOpeningBalance = (day: number, value: string) => setRecords((current) => ({ ...current, [day]: { ...current[day], bancaInicialOverride: value.trim() === "" ? null : Math.max(0, Number(value)) } }));
  const activeBank = activeRow?.bancaInicial ?? config.bancaInicial;
  const stakeR1Total = config.stakeR1PorArea * 2;
  const stakeR2Total = stakeR1Total * 2;
  const blockSignals = config.bloquearSinaisMetaDiaria && metaDiaBatida;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-black tracking-widest">GERENCIAMENTO DE BANCA E JUROS COMPOSTOS</h1>
        <p className="mt-1 text-sm text-muted-foreground">Planejamento diário editável, projeção composta e acompanhamento do realizado. Valores são simulações e não previsões de lucro.</p>
      </header>

      {blockSignals && <div role="alert" className="rounded-xl border-2 border-emerald-500 bg-emerald-500/10 p-4 font-black text-emerald-500">SINAIS BLOQUEADOS: META DIÁRIA ALCANÇADA. A opção de proteção de lucro está ativa.</div>}
      {!alertaDispensado && metaDiaBatida && <div role="alert" aria-live="assertive" className="rounded-xl border-2 border-emerald-500 bg-emerald-500/10 p-5"><div className="flex items-start gap-3"><CheckCircle2 className="h-7 w-7 text-emerald-500"/><div className="flex-1"><h2 className="text-xl font-black text-emerald-500">META DIÁRIA ALCANÇADA</h2><p className="mt-1 text-sm">Resultado registrado: {dinheiro(resultadoDia)} · Meta do dia: {dinheiro(activeRow?.metaDia ?? 0)}.</p></div><button onClick={() => setAlertaDispensado(true)} className="rounded border border-border px-3 py-1 text-xs">FECHAR</button></div></div>}
      {!alertaDispensado && resumo.stopLossCritico && <div role="alert" className="rounded-xl border-2 border-rose-500 bg-rose-500/10 p-4 font-black text-rose-500"><ShieldAlert className="mr-2 inline h-5 w-5"/>STOP LOSS CRÍTICO: o limite financeiro da sessão foi atingido.</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="BANCA DO DIA ATIVO" value={dinheiro(activeBank)} icon={<Wallet className="h-4 w-4"/>}/>
        <Metric title="PROJEÇÃO FINAL" value={dinheiro(projecaoFinal)} tone="green"/>
        <Metric title="RESULTADO REALIZADO DO DIA" value={dinheiro(resultadoDia)} tone={resultadoDia >= 0 ? "green" : "red"}/>
        <Metric title="META DIÁRIA" value={dinheiro(activeRow?.metaDia ?? 0)}/>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-4 text-sm font-black tracking-widest">PARÂMETROS EDITÁVEIS</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Banca Inicial (R$)"><input className={inputClass} type="number" min="0" step="any" value={config.bancaInicial} onChange={(e) => update({ bancaInicial: Math.max(0, Number(e.target.value)) })}/></Field>
          <Field label="Meta Diária (%)"><input className={inputClass} type="number" min="0" step="0.1" value={config.metaDiariaPercentual} onChange={(e) => update({ metaDiariaPercentual: Math.max(0, Number(e.target.value)) })}/></Field>
          <Field label="Período de Operação (dias)"><input className={inputClass} type="number" min="1" max="3650" step="1" value={config.periodoDias} onChange={(e) => update({ periodoDias: Math.max(1, Math.min(3650, Math.floor(Number(e.target.value) || 1))) })}/></Field>
          <Field label="Data inicial da operação"><input className={inputClass} type="date" value={config.dataInicio} onChange={(e) => update({ dataInicio: e.target.value || dataLocal() })}/></Field>
          <Field label="Stake Base R1 por Área (R$)"><input className={inputClass} type="number" min="0" step="0.5" value={config.stakeR1PorArea} onChange={(e) => update({ stakeR1PorArea: Math.max(0, Number(e.target.value)), stakeR2PorArea: Math.max(0, Number(e.target.value)) * 2 })}/></Field>
          <Field label="Stop Loss diário (R$)"><input className={inputClass} type="number" min="0" step="any" value={config.stopLossMaximo} onChange={(e) => update({ stopLossMaximo: Math.max(0, Number(e.target.value)) })}/></Field>
        </div>
        <div className="mt-4 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/5 p-4"><p className="text-xs font-black tracking-widest text-emerald-500">PROJEÇÃO DE JUROS COMPOSTOS</p><p className="mt-2 text-2xl font-black">Projeção Final acumulada em {config.periodoDias} dias: {dinheiro(projecaoFinal)}</p><p className="mt-1 text-xs text-muted-foreground">Cálculo teórico: banca inicial × (1 + meta diária) elevado ao número de dias.</p></div>
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3"><input type="checkbox" className="mt-1" checked={config.bloquearSinaisMetaDiaria} onChange={(e) => update({ bloquearSinaisMetaDiaria: e.target.checked })}/><span><strong className="block text-sm">Bloquear novos sinais ao atingir a meta diária</strong><span className="text-xs text-muted-foreground">Quando ativado, a catalogação oculta o popup de entrada após registrar resultado diário igual ou superior à meta.</span></span></label>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-black tracking-widest">STAKES INTEGRADAS À CATALOGAÇÃO</h2><p className="mt-1 text-xs text-muted-foreground">Calculadas pela banca inicial do dia ativo; R2 é o dobro de R1.</p></div><span className="rounded-lg border border-border px-3 py-2 text-xs font-bold">DIA {activeDay}</span></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-sky-500/40 bg-sky-500/5 p-4"><p className="text-xs font-black text-sky-500">STAKE R1</p><p className="mt-2 text-2xl font-black">{dinheiro(stakeR1Total)}</p><p className="text-xs text-muted-foreground">2 áreas × {dinheiro(config.stakeR1PorArea)} por área · stake total sugerida</p></div><div className="rounded-lg border border-orange-500/40 bg-orange-500/5 p-4"><p className="text-xs font-black text-orange-500">STAKE R2 · SMART GALE 1</p><p className="mt-2 text-2xl font-black">{dinheiro(stakeR2Total)}</p><p className="text-xs text-muted-foreground">2× a stake R1</p></div></div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-black tracking-widest">JUROS COMPOSTOS · PLANEJADO VS. REALIZADO</h2><p className="mt-1 text-xs text-muted-foreground">Edite o resultado de qualquer dia; todos os saldos e metas seguintes serão recalculados automaticamente.</p></div><button type="button" onClick={() => setConfirmarReset(true)} className="rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-accent">LIMPAR RESULTADOS</button></div>
        {confirmarReset && <div role="alertdialog" className="mb-3 rounded-lg border border-rose-500/50 p-3 text-sm"><p>Limpar todos os resultados manuais desta tabela?</p><div className="mt-2 flex gap-2"><button onClick={() => { setRecords({}); setConfirmarReset(false); }} className="rounded bg-rose-600 px-3 py-2 text-xs font-bold text-white">CONFIRMAR</button><button onClick={() => setConfirmarReset(false)} className="rounded border border-border px-3 py-2 text-xs">CANCELAR</button></div></div>}
        <div className="overflow-x-auto"><table className="w-full min-w-[1050px] border-collapse text-left text-xs"><thead><tr className="border-b border-border text-muted-foreground">{["Dia","Banca Inicial do Dia (R$)","Meta do Dia (R$)","Resultado Realizado (R$)","Banca Final Real (R$)","Status"].map((title) => <th key={title} className="px-3 py-3 font-black">{title}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.dia} className={row.dia === activeDay ? "border-b border-border bg-amber-400/10" : "border-b border-border/60"}><td className="px-3 py-3 font-black">Dia {row.dia}<span className="block font-normal text-muted-foreground">{row.data}</span>{row.dia === activeDay && <span className="mt-1 inline-block rounded bg-amber-400 px-2 py-1 text-[10px] font-black text-black">ATIVO</span>}</td><td className="px-3 py-3"><input aria-label={`Banca inicial dia ${row.dia}`} className="w-36 rounded border border-border bg-background px-2 py-2" type="number" min="0" step="any" placeholder={dinheiro(row.bancaInicial)} value={records[row.dia]?.bancaInicialOverride ?? ""} onChange={(e) => updateOpeningBalance(row.dia, e.target.value)} /></td><td className="px-3 py-3">{dinheiro(row.metaDia)}</td><td className="px-3 py-3"><input aria-label={`Resultado realizado dia ${row.dia}`} className="w-36 rounded border border-border bg-background px-2 py-2" type="number" step="any" placeholder="Pendente" value={records[row.dia]?.resultadoRealizado ?? ""} onChange={(e) => updateResult(row.dia, e.target.value)}/></td><td className="px-3 py-3 font-bold">{row.bancaFinal === null ? "— (projetado)" : dinheiro(row.bancaFinal)}</td><td className="px-3 py-3"><Status status={row.status}/></td></tr>)}</tbody></table></div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4"><h2 className="mb-2 text-sm font-black tracking-widest">RESUMO E SEGURANÇA</h2><div className="flex items-start gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-4 w-4 shrink-0"/><p>Os resultados realizados são entradas manuais e ficam salvos neste navegador. Os dados do histórico de sinais não são automaticamente convertidos em valores reais porque o motor atual não registra stake nem lucro monetário por sinal. Juros compostos são uma projeção matemática, não uma garantia de resultado. Banca estimada pelo histórico de sinais: {dinheiro(resumo.bancaAtual)}.</p></div></section>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-bold">{label}{children}</label>; }
function Metric({ title, value, icon, tone }: { title: string; value: string; icon?: React.ReactNode; tone?: "green" | "red" }) { return <div className="rounded-xl border border-border bg-card p-4"><p className="flex items-center gap-2 text-[10px] font-black tracking-widest text-muted-foreground">{icon}{title}</p><p className={`mt-2 text-xl font-black ${tone === "green" ? "text-emerald-500" : tone === "red" ? "text-rose-500" : ""}`}>{value}</p></div>; }
function Status({ status }: { status: "META_ATINGIDA" | "PARCIAL" | "STOP_LOSS" | "PENDENTE" }) { const map = { META_ATINGIDA: ["🟢 Meta Atingida","bg-emerald-500/15 text-emerald-500"], PARCIAL: ["🟡 Parcial","bg-amber-500/15 text-amber-500"], STOP_LOSS: ["🔴 Stop Loss","bg-rose-500/15 text-rose-500"], PENDENTE: ["⚪ Pendente","bg-muted text-muted-foreground"] } as const; return <span className={`inline-flex rounded-full px-2 py-1 font-black ${map[status][1]}`}>{map[status][0]}</span>; }
