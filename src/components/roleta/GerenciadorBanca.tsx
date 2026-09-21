import { useEffect, useMemo, useState } from "react";
import { useSinais } from "@/lib/roleta/useSinais";

type Perfil = "conservador" | "equilibrado" | "agressivo";
type Game = "Roleta Europeia" | "Roleta Americana";
type Market = "Alto / Baixo (Odd 2x)" | "Colunas (Odd 3x)" | "Dúzias (Odd 3x)";

interface HistoricoBanca {
  id: number;
  strategy: string;
  stake: number;
  result: number;
  bankAfter: number;
  isWin: boolean;
  signalId?: string;
  recordedAt: number;
}

interface BancaState {
  bank: number;
  winPct: number;
  lossPct: number;
  odd: number;
  profile: Perfil;
  game: Game;
  market: Market;
  currentBank: number;
  initialBank: number;
  history: HistoricoBanca[];
  nextStrategyName: string;
  processedSignals: string[];
}

const STORAGE_KEY = "roleta-gerenciador-banca-v1";

const DEFAULT_STATE: BancaState = {
  bank: 100,
  winPct: 7,
  lossPct: 20,
  odd: 2,
  profile: "conservador",
  game: "Roleta Europeia",
  market: "Alto / Baixo (Odd 2x)",
  currentBank: 100,
  initialBank: 100,
  history: [],
  nextStrategyName: "Sinal v6.6",
  processedSignals: [],
};

const PROFILE_FACTOR: Record<Perfil, number> = {
  conservador: 0.1,
  equilibrado: 0.2,
  agressivo: 0.35,
};

export function updateNextStrategyName(name: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("roleta-next-strategy", name || "Sinal v6.6");
  window.dispatchEvent(new CustomEvent("roleta:strategy", { detail: name || "Sinal v6.6" }));
}

export function registerBancaResult(isWin: boolean) {
  window.dispatchEvent(new CustomEvent("roleta:banca-result", { detail: { isWin } }));
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function loadState(): BancaState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<BancaState>) };
  } catch {
    return DEFAULT_STATE;
  }
}

function calculateSmartStake(state: BancaState) {
  const remainingWin =
    (state.initialBank * state.winPct) / 100 - (state.currentBank - state.initialBank);
  const remainingLoss =
    (state.initialBank * state.lossPct) / 100 + (state.currentBank - state.initialBank);

  if (remainingWin <= 0 || remainingLoss <= 0) return 0;

  const idealStake = remainingWin * PROFILE_FACTOR[state.profile];
  const maxSafeStake = remainingLoss * 0.5;
  return Math.max(0, Math.min(idealStake, maxSafeStake));
}

export function GerenciadorBanca() {
  const { sinais } = useSinais();
  const [state, setState] = useState<BancaState>(() => loadState());
  const [step, setStep] = useState(1);
  const [wizardOpen, setWizardOpen] = useState(true);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const storedStrategy = window.localStorage.getItem("roleta-next-strategy");
    if (storedStrategy) setState((s) => ({ ...s, nextStrategyName: storedStrategy }));

    const onStrategy = (event: Event) => {
      const name = (event as CustomEvent<string>).detail;
      setState((s) => ({ ...s, nextStrategyName: name || "Sinal v6.6" }));
    };
    window.addEventListener("roleta:strategy", onStrategy);

    return () => window.removeEventListener("roleta:strategy", onStrategy);
  }, []);

  const nextStake = useMemo(() => calculateSmartStake(state), [state]);

  const latestOperationalSignal = useMemo(() => {
    return [...sinais]
      .filter((s) => s.type === "ENTRY_SIGNAL" && s.confidence >= 78)
      .sort((a, b) => b.timestamp - a.timestamp)[0] ?? null;
  }, [sinais]);

  useEffect(() => {
    if (!latestOperationalSignal) return;

    const strategy = latestOperationalSignal.title || "Sinal v6.6";
    if (state.nextStrategyName !== strategy) {
      updateNextStrategyName(strategy);
      setState((s) => ({ ...s, nextStrategyName: strategy }));
    }

    const resolved =
      latestOperationalSignal.status === "WIN"
        ? true
        : latestOperationalSignal.status === "RED"
          ? false
          : null;

    if (resolved === null || state.processedSignals.includes(latestOperationalSignal.id)) return;

    const stake = calculateSmartStake(state);
    if (stake <= 0) return;

    const profit = resolved ? stake * (state.odd - 1) : -stake;
    const bankAfter = state.currentBank + profit;

    setState((s) => ({
      ...s,
      currentBank: bankAfter,
      history: [
        {
          id: s.history.length + 1,
          strategy,
          stake,
          result: profit,
          bankAfter,
          isWin: resolved,
          signalId: latestOperationalSignal.id,
          recordedAt: Date.now(),
        },
        ...s.history,
      ],
      processedSignals: [...s.processedSignals, latestOperationalSignal.id],
    }));
  }, [latestOperationalSignal, state]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ isWin?: boolean }>).detail;
      if (typeof detail?.isWin === "boolean") registerResult(detail.isWin);
    };
    window.addEventListener("roleta:banca-result", handler);
    return () => window.removeEventListener("roleta:banca-result", handler);
  }, [state]);

  function registerResult(isWin: boolean) {
    const stake = calculateSmartStake(state);
    if (stake <= 0) {
      window.alert("Sessão encerrada: meta atingida ou Stop Loss acionado.");
      return;
    }

    const profit = isWin ? stake * (state.odd - 1) : -stake;
    const bankAfter = state.currentBank + profit;

    setState((s) => ({
      ...s,
      currentBank: bankAfter,
      history: [
        {
          id: s.history.length + 1,
          strategy: s.nextStrategyName,
          stake,
          result: profit,
          bankAfter,
          isWin,
          recordedAt: Date.now(),
        },
        ...s.history,
      ],
    }));
  }

  function startSession() {
    setState((s) => ({
      ...s,
      currentBank: s.bank,
      initialBank: s.bank,
      history: [],
      processedSignals: [],
    }));
    setStep(1);
    setWizardOpen(false);
  }

  function resetSession() {
    if (!window.confirm("Deseja realmente reiniciar a sessão? Todos os dados da sessão serão perdidos.")) return;
    setState((s) => ({
      ...s,
      currentBank: s.bank,
      initialBank: s.bank,
      history: [],
      processedSignals: [],
    }));
    setStep(1);
    setWizardOpen(true);
  }

  const remainingWin = Math.max(0, (state.initialBank * state.winPct) / 100 - (state.currentBank - state.initialBank));
  const remainingLoss = Math.max(0, (state.initialBank * state.lossPct) / 100 + (state.currentBank - state.initialBank));
  const pl = state.currentBank - state.initialBank;

  const renderWizard = () => {
    const progress = (step / 7) * 100;

    const content = (() => {
      if (step === 1) {
        return <Slider label="Qual a sua banca inicial?" value={state.bank} min={10} max={10000} step={10} display={formatBRL(state.bank)} onChange={(v) => setState((s) => ({ ...s, bank: v }))} />;
      }
      if (step === 2) {
        return <Slider label="🎯 Qual o lucro pretendido (Stop Win)?" value={state.winPct} min={1} max={100} display={state.winPct + "%"} onChange={(v) => setState((s) => ({ ...s, winPct: v }))} hint={formatBRL(state.bank * state.winPct / 100)} />;
      }
      if (step === 3) {
        return <Slider label="Qual a perda máxima aceitável (Stop Loss)?" value={state.lossPct} min={1} max={99} display={state.lossPct + "%"} onChange={(v) => setState((s) => ({ ...s, lossPct: v }))} hint={formatBRL(state.bank * state.lossPct / 100)} />;
      }
      if (step === 4) {
        return (
          <div className="space-y-3">
            <SelectField value={state.game} onChange={(v) => setState((s) => ({ ...s, game: v as Game }))} options={["Roleta Europeia", "Roleta Americana"]} />
            <SelectField value={state.market} onChange={(v) => setState((s) => ({ ...s, market: v as Market }))} options={["Alto / Baixo (Odd 2x)", "Colunas (Odd 3x)", "Dúzias (Odd 3x)"]} />
          </div>
        );
      }
      if (step === 5) {
        return <Slider label="📈 Confirme a odd (payout)" value={state.odd} min={1.01} max={20} step={0.01} display={state.odd.toFixed(2) + "x"} onChange={(v) => setState((s) => ({ ...s, odd: v }))} />;
      }
      if (step === 6) {
        return (
          <div className="grid grid-cols-3 gap-2">
            {(["conservador", "equilibrado", "agressivo"] as Perfil[]).map((profile) => (
              <button key={profile} onClick={() => setState((s) => ({ ...s, profile }))} className={`rounded-lg border-2 p-3 text-center transition ${state.profile === profile ? "border-emerald-400 bg-emerald-400/10" : "border-border bg-background"}`}>
                <div className="text-sm font-black capitalize">{profile}</div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {profile === "conservador" ? "Entradas menores, mais fôlego" : profile === "equilibrado" ? "Meio-termo entre risco e meta" : "Entradas maiores, meta rápida"}
                </div>
              </button>
            ))}
          </div>
        );
      }
      return (
        <div className="space-y-1 rounded-lg bg-background p-4 text-sm">
          <ReviewRow label="Banca Inicial" value={formatBRL(state.bank)} />
          <ReviewRow label="Meta (Stop Win)" value={"+" + formatBRL(state.bank * state.winPct / 100)} green />
          <ReviewRow label="Risco (Stop Loss)" value={"-" + formatBRL(state.bank * state.lossPct / 100)} red />
          <ReviewRow label="Odd Confirmada" value={state.odd.toFixed(2) + "x"} />
          <ReviewRow label="Perfil Escolhido" value={state.profile.toUpperCase()} />
          <div className="mt-2 flex justify-between border-t border-border pt-3 font-black text-emerald-400">
            <span>1ª Entrada Sugerida</span><span>{formatBRL(calculateSmartStake({ ...state, initialBank: state.bank, currentBank: state.bank }))}</span>
          </div>
        </div>
      );
    })();

    return (
      <div className="gm-overlay fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
        <div className="gm-wizard-card w-full max-w-[450px] rounded-2xl border border-slate-700 bg-slate-800 p-6 text-slate-50 shadow-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">✨ {step === 7 ? "Revise sua configuração" : stepsTitle(step)}</h2>
            <button onClick={() => setWizardOpen(false)} className="text-muted-foreground">✕</button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Passo {step} de 7 — responda uma pergunta por vez.</p>
          <div className="gm-progress-track my-5 h-1 overflow-hidden rounded bg-slate-700"><div className="gm-progress-fill h-full bg-emerald-400 transition-all" style={{ width: progress + "%" }} /></div>
          {content}
          <div className="mt-6 flex justify-between">
            <button disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))} className="rounded-lg border border-border px-4 py-2 text-sm font-bold disabled:invisible">← Voltar</button>
            <button onClick={() => step === 7 ? startSession() : setStep((s) => s + 1)} className="gm-btn gm-btn-primary rounded-lg bg-emerald-400 px-5 py-2 text-sm font-black text-black">{step === 7 ? "Iniciar operação" : "Continuar →"}</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section>
      {wizardOpen && renderWizard()}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-black tracking-widest">GERENCIADOR DE BANCA · RECOVERY SMART</h1>
          <p className="mt-1 text-xs text-muted-foreground">Gestão operacional da banca conectada aos sinais do BIP Analyzer.</p>
        </div>
        <button onClick={resetSession} className="rounded border border-border px-3 py-2 text-xs font-bold hover:bg-accent">REINICIAR SESSÃO</button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Banca Atual" value={formatBRL(state.currentBank)} />
        <Stat label="Meta (Stop Win)" value={"+" + formatBRL(state.initialBank * state.winPct / 100)} green />
        <Stat label="Limite (Stop Loss)" value={"-" + formatBRL(state.initialBank * state.lossPct / 100)} red />
        <Stat label="Lucro/Prejuízo" value={(pl >= 0 ? "+" : "") + formatBRL(pl)} green={pl >= 0} red={pl < 0} />
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="text-[11px] font-black tracking-widest text-muted-foreground">PRÓXIMA ENTRADA SUGERIDA</div>
            <div className="text-4xl font-black text-emerald-400">{formatBRL(nextStake)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {latestOperationalSignal ? latestOperationalSignal.title : state.nextStrategyName}
              {state.history.length > 0 && !state.history[0]!.isWin ? " · ⚠️ recuperação segura" : " · perfil " + state.profile}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => registerResult(true)} className="gm-btn-result rounded-xl bg-emerald-400 px-6 py-4 text-lg font-black text-black">✅ GREEN</button>
            <button onClick={() => registerResult(false)} className="gm-btn-result rounded-xl bg-red-500 px-6 py-4 text-lg font-black text-white">❌ RED</button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
          <Mini label="Meta restante" value={formatBRL(remainingWin)} />
          <Mini label="Stop restante" value={formatBRL(remainingLoss)} />
          <Mini label="Perfil" value={state.profile.toUpperCase()} />
          <Mini label="Estratégia" value={state.nextStrategyName} />
        </div>
      </div>

      <div className="mt-4 overflow-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[760px] text-xs">
          <thead><tr className="bg-muted">{["#", "Estratégia", "Entrada", "Resultado", "Banca Pós", "Status"].map((h) => <th key={h} className="px-3 py-3 text-left font-black">{h}</th>)}</tr></thead>
          <tbody>
            {state.history.map((h) => (
              <tr key={`${h.id}-${h.recordedAt}`} className="border-t border-border">
                <td className="px-3 py-3">{h.id}</td>
                <td className="px-3 py-3 font-bold">{h.strategy}</td>
                <td className="px-3 py-3">{formatBRL(h.stake)}</td>
                <td className={`px-3 py-3 font-bold ${h.isWin ? "text-emerald-400" : "text-red-400"}`}>{h.isWin ? "+" : ""}{formatBRL(h.result)}</td>
                <td className="px-3 py-3">{formatBRL(h.bankAfter)}</td>
                <td className="px-3 py-3"><span className={`rounded px-2 py-1 font-black ${h.isWin ? "bg-emerald-400/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>{h.isWin ? "GREEN" : "RED"}</span></td>
              </tr>
            ))}
            {!state.history.length && <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">Nenhuma entrada registrada nesta sessão.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Limites de segurança: a stake nunca supera 50% do Stop Loss restante. O resultado automático usa o status auditado do BIP Analyzer; os botões GREEN/RED permanecem disponíveis como fallback manual.
      </div>
    </section>
  );
}

const stepsTitle = (step: number) =>
  ({
    1: "Qual a sua banca inicial?",
    2: "🎯 Qual o lucro pretendido (Stop Win)?",
    3: "Qual a perda máxima aceitável (Stop Loss)?",
    4: "🎲 Onde você vai operar?",
    5: "📈 Confirme a odd (payout)",
    6: "👤 Qual perfil de operação?",
    7: "✅ Revise sua configuração",
  })[step] ?? "Configurar sessão";

function Slider({ label, value, min, max, step = 1, display, onChange, hint }: { label: string; value: number; min: number; max: number; step?: number; display: string; onChange?: (value: number) => void; hint?: string }) {
  return (
    <div>
      <div className="gm-question text-sm font-semibold">{label}</div>
      <div className="gm-value-display py-4 text-center text-3xl font-black text-emerald-400">{display}</div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange?.(Number(e.target.value))} className="gm-slider w-full accent-emerald-400" />
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>{min}</span><span>{max}</span></div>
      {hint && <div className="mt-2 text-center text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function SelectField({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm">{options.map((o) => <option key={o}>{o}</option>)}</select>;
}

function ReviewRow({ label, value, green, red }: { label: string; value: string; green?: boolean; red?: boolean }) {
  return <div className="flex justify-between border-b border-border py-2 last:border-0"><span>{label}</span><b className={green ? "text-emerald-400" : red ? "text-red-400" : ""}>{value}</b></div>;
}

function Stat({ label, value, green, red }: { label: string; value: string; green?: boolean; red?: boolean }) {
  return <div className="rounded-xl border border-border bg-card p-4"><div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</div><div className={`mt-1 text-xl font-black ${green ? "text-emerald-400" : red ? "text-red-400" : ""}`}>{value}</div></div>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-background p-3"><div className="text-[10px] font-black text-muted-foreground">{label}</div><div className="mt-1 truncate font-bold">{value}</div></div>;
}


const GM_STYLE_ID = "gerenciador-banca-v2-styles";

if (typeof document !== "undefined" && !document.getElementById(GM_STYLE_ID)) {
  const style = document.createElement("style");
  style.id = GM_STYLE_ID;
  style.textContent = `
    .gm-overlay { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .gm-wizard-card { border-color: #334155; box-shadow: 0 25px 50px rgba(0,0,0,.5); }
    .gm-progress-track { background: #334155; }
    .gm-progress-fill { background: #4ade80; }
    .gm-value-display { color: #4ade80; }
    .gm-slider { accent-color: #4ade80; cursor: pointer; }
    .gm-select { color: #f8fafc; }
    .gm-btn { border: 0; font-weight: 700; cursor: pointer; }
    .gm-btn-primary { background: #4ade80; color: #000; }
    .gm-btn-result { border: 0; cursor: pointer; }
    .gm-btn-result:active { transform: scale(.98); }
  `;
  document.head.appendChild(style);
}
