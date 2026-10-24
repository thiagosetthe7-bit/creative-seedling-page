import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert, Wallet } from "lucide-react";
import { useSinais } from "@/lib/roleta/useSinais";
import { BANKROLL_KEY, carregarConfigBanca, calcularBanca, DEFAULT_BANKROLL_CONFIG, type BankrollConfig } from "@/lib/roleta/bankroll";

const dinheiro = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const inputClass = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-amber-400";

export function BankrollPanel() {
  const { tracking } = useSinais();
  const [config, setConfig] = useState<BankrollConfig>(() => carregarConfigBanca());
  const resumo = useMemo(() => calcularBanca(tracking.signals, config), [tracking.signals, config]);
  const [alertaDispensado, setAlertaDispensado] = useState(false);

  useEffect(() => {
    try { window.localStorage.setItem(BANKROLL_KEY, JSON.stringify(config)); } catch { /* armazenamento opcional */ }
  }, [config]);

  useEffect(() => { setAlertaDispensado(false); }, [resumo.metaBatida, resumo.stopLossCritico]);

  const update = (patch: Partial<BankrollConfig>) => setConfig((current) => ({ ...current, ...patch }));
  const active = tracking.signals.filter((signal) => signal.status !== "CONCLUÍDO");
  const resetSession = () => {
    if (window.confirm("Iniciar nova sessão? Isso zera apenas o cálculo financeiro da sessão e mantém o histórico de catalogação/sinais.")) {
      setConfig((current) => ({ ...current, bancaInicial: current.bancaAtual ?? current.bancaInicial }));
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-black tracking-widest">GERENCIAMENTO DE BANCA</h1>
        <p className="mt-1 text-sm text-muted-foreground">Controle de sessão, exposição por entrada e limites de segurança. Valores estimados a partir dos resultados registrados.</p>
      </header>

      {!alertaDispensado && resumo.metaBatida && (
        <div role="alertdialog" aria-live="assertive" className="rounded-xl border-2 border-emerald-500 bg-emerald-500/10 p-5">
          <div className="flex items-start gap-3"><CheckCircle2 className="mt-1 h-7 w-7 text-emerald-500" /><div className="flex-1"><h2 className="text-xl font-black text-emerald-500">META BATIDA</h2><p className="mt-1 text-sm">Lucro líquido de {dinheiro(resumo.lucroLiquido)}. Trate a sessão como encerrada e não inicie novas entradas.</p></div><button onClick={() => setAlertaDispensado(true)} className="rounded border border-border px-3 py-1 text-xs">FECHAR</button></div>
        </div>
      )}
      {!alertaDispensado && resumo.stopLossCritico && (
        <div role="alertdialog" aria-live="assertive" className="rounded-xl border-2 border-rose-500 bg-rose-500/10 p-5">
          <div className="flex items-start gap-3"><ShieldAlert className="mt-1 h-7 w-7 text-rose-500" /><div className="flex-1"><h2 className="text-xl font-black text-rose-500">STOP LOSS CRÍTICO</h2><p className="mt-1 text-sm">Limite de perda atingido. Interrompa novas entradas e encerre a sessão.</p></div><button onClick={() => setAlertaDispensado(true)} className="rounded border border-border px-3 py-1 text-xs">FECHAR</button></div>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="BANCA ATUAL" value={dinheiro(resumo.bancaAtual)} icon={<Wallet className="h-4 w-4" />} />
        <Metric title="LUCRO / PREJUÍZO LÍQUIDO" value={dinheiro(resumo.lucroLiquido)} tone={resumo.lucroLiquido >= 0 ? "green" : "red"} />
        <Metric title="GREENS / REDS" value={`${resumo.greens} / ${resumo.reds}`} />
        <Metric title="EXPOSIÇÃO ATIVA" value={dinheiro(active.reduce((sum, signal) => sum + (signal.status === "GALE 1 EM ANDAMENTO" ? config.stakeR2PorArea * 2 : config.stakeR1PorArea * 2), 0))} />
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-black tracking-widest"><Wallet className="h-4 w-4" /> CONFIGURAÇÃO DA SESSÃO</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Banca Inicial (R$)"><input className={inputClass} type="number" min="0" step="0.5" value={config.bancaInicial} onChange={(e) => update({ bancaInicial: Math.max(0, Number(e.target.value)) })} /></Field>
          <Field label="Modo da Meta"><select className={inputClass} value={config.metaModo} onChange={(e) => update({ metaModo: e.target.value as BankrollConfig["metaModo"] })}><option value="valor">Valor em R$</option><option value="percentual">Percentual da banca inicial</option></select></Field>
          {config.metaModo === "valor" ? <Field label="Meta da Sessão (R$)"><input className={inputClass} type="number" min="0" step="0.5" value={config.metaValor} onChange={(e) => update({ metaValor: Math.max(0, Number(e.target.value)) })} /></Field> : <Field label="Meta da Sessão (%)"><input className={inputClass} type="number" min="0" step="1" value={config.metaPercentual} onChange={(e) => update({ metaPercentual: Math.max(0, Number(e.target.value)) })} /></Field>}
          <Field label="Lucro Alvo por Entrada (R$)"><input className={inputClass} type="number" min="0" step="0.5" value={config.lucroAlvoPorEntrada} onChange={(e) => update({ lucroAlvoPorEntrada: Math.max(0, Number(e.target.value)) })} /></Field>
          <Field label="Stop Loss Máximo (R$)"><input className={inputClass} type="number" min="0.5" step="0.5" value={config.stopLossMaximo} onChange={(e) => update({ stopLossMaximo: Math.max(0.5, Number(e.target.value)) })} /></Field>
          <Field label="Stake R1 por área (R$)"><input className={inputClass} type="number" min="0.5" step="0.5" value={config.stakeR1PorArea} onChange={(e) => update({ stakeR1PorArea: Math.max(0.5, Number(e.target.value)) })} /></Field>
          <Field label="Stake R2 / Gale 1 por área (R$)"><input className={inputClass} type="number" min="0.5" step="0.5" value={config.stakeR2PorArea} onChange={(e) => update({ stakeR2PorArea: Math.max(0.5, Number(e.target.value)) })} /></Field>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-black tracking-widest">PROGRESSO DA META</h2><p className="mt-1 text-xs text-muted-foreground">Meta configurada: {dinheiro(resumo.metaFinanceira)}</p></div><strong className="text-lg">{Math.round(resumo.progressoMeta)}%</strong></div>
        <div className="h-4 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${resumo.progressoMeta}%` }} /></div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>R$ 0,00</span><span>{dinheiro(resumo.metaFinanceira)}</span></div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-black tracking-widest">CÁLCULO DE STAKES EM TEMPO REAL</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-sky-500/40 bg-sky-500/5 p-4"><p className="text-xs font-black text-sky-500">R1 · ENTRADA INICIAL</p><p className="mt-2 text-2xl font-black">{dinheiro(config.stakeR1PorArea * 2)}</p><p className="text-xs text-muted-foreground">{dinheiro(config.stakeR1PorArea)} por área · 2 áreas</p></div>
          <div className="rounded-lg border border-orange-500/40 bg-orange-500/5 p-4"><p className="text-xs font-black text-orange-500">R2 · GALE 1</p><p className="mt-2 text-2xl font-black">{dinheiro(config.stakeR2PorArea * 2)}</p><p className="text-xs text-muted-foreground">{dinheiro(config.stakeR2PorArea)} por área · 2 áreas</p></div>
        </div>
        {active.length > 0 && <div className="mt-3 space-y-2">{active.map((signal) => <div key={signal.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"><span className="font-bold">{signal.strategyLabel} · {signal.target}</span><span className="font-black">{signal.status === "GALE 1 EM ANDAMENTO" ? `R2: ${dinheiro(config.stakeR2PorArea * 2)}` : `R1: ${dinheiro(config.stakeR1PorArea * 2)}`}</span></div>)}</div>}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-black tracking-widest">RESUMO DA SESSÃO</h2><p className="mt-1 text-xs text-muted-foreground">Os resultados concluídos do histórico são contabilizados automaticamente.</p></div><button type="button" onClick={() => setConfig({ ...DEFAULT_BANKROLL_CONFIG, bancaInicial: resumo.bancaAtual })} className="rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-accent">NOVA SESSÃO</button></div>
        <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-4 w-4 shrink-0" /><p>Simulação de controle de banca: GREEN adiciona o lucro-alvo configurado e RED desconta o stop loss configurado por ciclo. Ajuste os valores à sua regra real; esta tela não executa apostas nem garante resultados.</p></div>
      </section>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-bold">{label}{children}</label>; }
function Metric({ title, value, icon, tone }: { title: string; value: string; icon?: React.ReactNode; tone?: "green" | "red" }) { return <div className="rounded-xl border border-border bg-card p-4"><p className="flex items-center gap-2 text-[10px] font-black tracking-widest text-muted-foreground">{icon}{title}</p><p className={`mt-2 text-xl font-black ${tone === "green" ? "text-emerald-500" : tone === "red" ? "text-rose-500" : ""}`}>{value}</p></div>; }
