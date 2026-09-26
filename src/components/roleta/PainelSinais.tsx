import { autoTestResolver, gerarLogAuditoriaCSV, type Sinal } from "@/lib/roleta/engine";
import { acoes } from "@/lib/roleta/store";
import { useCallback, useEffect, useRef, useState } from "react";

const PRIORIDADE: Record<Sinal["priority"], string> = {
  CRITICAL: "CRÍTICA",
  HIGH: "ALTA",
  MEDIUM: "MÉDIA",
  LOW: "BAIXA",
};

export function StatusTag({ status }: { status: string }) {
  const cores: Record<string, string> = {
    AGUARDANDO_RESULTADO: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
    NO_BET: "bg-muted text-muted-foreground",
    WIN: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    RED: "bg-red-500/20 text-red-700 dark:text-red-300",
    CANCELADO: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${cores[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}

export function PainelSinais({ sinais }: { sinais: Sinal[] }) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [selfTest, setSelfTest] = useState<{ok:boolean;errors:string[]}>(() => autoTestResolver());
  const containerRef = useRef<HTMLUListElement | null>(null);
  const inoperante = sinais.some((s) => s.auditMessage?.includes("AVALIADOR INOPERANTE")) || !selfTest.ok;
  const modoTexto = inoperante ? "MODO INOPERANTE" : "MODO OPERANTE";

  useEffect(() => {
    const onTest = (e: Event) => setSelfTest((e as CustomEvent<{ok:boolean;errors:string[]}>).detail);
    window.addEventListener("roleta:self-test", onTest);
    return () => window.removeEventListener("roleta:self-test", onTest);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onClick = (event: Event) => {
      const target = event.target as HTMLElement;
      const selfTestButton = target.closest<HTMLButtonElement>("[data-alert-self-test]");
      if (selfTestButton) {
        window.dispatchEvent(new CustomEvent("roleta:delegation-self-test", { detail: true }));
        return;
      }
      const button = target.closest<HTMLButtonElement>("[data-alert-action][data-alert-id]");
      if (!button || button.disabled) return;
      const id = button.dataset.alertId;
      const action = button.dataset.alertAction;
      const sinal = sinais.find((s) => s.id === id);
      if (!sinal) return;
      if (action === "G") {
        acoes.marcarVisto(id);
        window.dispatchEvent(new CustomEvent("roleta:banca-result", { detail: { isWin: true, signalId: id, source: "alert-row" } }));
        window.dispatchEvent(new CustomEvent("roleta:fechar-popup", { detail: { signalId: id } }));
        button.classList.add("ring-2");
        setTimeout(() => button.classList.remove("ring-2"), 250);
      } else if (action === "G1" && sinal.gale1Liberado) {
        acoes.marcarVisto(id);
        window.dispatchEvent(new CustomEvent("roleta:banca-gale1", { detail: { signalId: id, source: "alert-row" } }));
        window.dispatchEvent(new CustomEvent("roleta:fechar-popup", { detail: { signalId: id } }));
        button.classList.add("ring-2");
        setTimeout(() => button.classList.remove("ring-2"), 250);
      }
    };
    el.addEventListener("click", onClick);
    const onDelegationTest = () => setSelfTest((current) => current.ok ? current : current);
    window.addEventListener("roleta:delegation-self-test", onDelegationTest);

    const probe = document.createElement("button");
    probe.type = "button";
    probe.dataset.alertSelfTest = "1";
    probe.hidden = true;
    el.appendChild(probe);
    let delegationPassed = false;
    const markPassed = () => { delegationPassed = true; };
    window.addEventListener("roleta:delegation-self-test", markPassed);
    probe.click();
    const timer = window.setTimeout(() => {
      if (!delegationPassed) setSelfTest((current) => ({ ok:false, errors:[...current.errors, "G/G1 event delegation"] }));
      probe.remove();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("roleta:delegation-self-test", onDelegationTest);
      window.removeEventListener("roleta:delegation-self-test", markPassed);
      el.removeEventListener("click", onClick);
      probe.remove();
    };
  }, [sinais]);

  const ultimos = [...sinais].reverse().slice(0, 16);

  const exportarCSV = useCallback(() => {
    const csv = gerarLogAuditoriaCSV(sinais);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "log-auditoria-sinais.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [sinais]);


  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-sinal/15 px-3 py-2">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-black">
          <span className={selfTest.ok ? "rounded bg-emerald-500/20 px-2 py-1 text-emerald-400" : "rounded bg-red-500/20 px-2 py-1 text-red-400"}>
            {selfTest.ok ? "🟢 SELF-TEST 10/10" : `🔴 SELF-TEST FALHOU — ${selfTest.errors.join("; ")}`}
          </span>
          <span className={inoperante ? "rounded bg-red-500/20 px-2 py-1 text-red-400" : "rounded bg-emerald-500/20 px-2 py-1 text-emerald-400"}>
            {inoperante ? "MODO INOPERANTE" : "MODO OPERANTE"}
          </span>
        </div>
        {inoperante && <div className="mb-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-2 text-xs font-black text-amber-300">⚠️ AVALIADOR INOPERANTE — resultados suspensos, não opere</div>}
        {sinais.some((s) => s.type === "ENTRY_SIGNAL" && s.numeroSeguinte !== null && ["AWAITING","INVALID"].includes(s.auditResult) && !s.observacaoHostil) && (
          <div className="mb-2 rounded border border-red-500/50 bg-red-500/10 px-2 py-2 text-xs font-black text-red-400">
            ⚠️ FALHA DE RESOLUÇÃO: alerta ativo não resolveu mesmo com número seguinte presente. Ver normalizador.
          </div>
        )}
        <div className="flex items-center justify-between gap-2"><h2 className="text-xs font-black tracking-widest text-sinal">ALERTAS BIP</h2><button type="button" onClick={exportarCSV} className="rounded border border-border px-2 py-1 text-[10px] font-bold text-muted-foreground hover:text-foreground">EXPORTAR CSV</button></div>
      </div>
      <ul ref={containerRef} className="max-h-[520px] divide-y divide-border overflow-auto">
        {ultimos.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-muted-foreground">
            Nenhum BIP com alerta detectado.
          </li>
        )}
        {ultimos.map((s) => (
          <li key={s.id} className="border-l-4 px-3 py-2 text-xs" style={{ borderLeftColor: s.colorCode }}>
            <button type="button" className="w-full text-left" onClick={() => setAberto(aberto === s.id ? null : s.id)}>
              <div className="flex items-center justify-between gap-2"><span className="font-black">▸ {s.title}</span><span className="rounded px-2 py-0.5 text-[10px] font-black text-white" style={{ backgroundColor: s.colorCode }}>{PRIORIDADE[s.priority]}</span></div>
              <div className="mt-1 font-semibold">{s.message}</div>
              <div className="mt-0.5 text-muted-foreground">{s.bip === "timer" ? "BT" : "BR"} · entrada: {s.mainAction} · resultado: {s.auditNumero ?? "—"} · {s.auditResult === "NO_BET" ? "⏸ SEM APOSTA" : s.auditResult === "NA" ? "n/a" : s.auditResult === "GREEN" ? "✅ GREEN" : s.auditResult === "RED" ? "❌ RED" : s.auditResult === "INVALID" ? "⚠️ -" : s.auditResult === "PARTIAL" ? "🟡 PARTIAL" : "⏳ AGUARDANDO RESULTADO"}</div>
            </button>
            {s.type === "ENTRY_SIGNAL" && !s.observacaoHostil && s.confidence >= 78 && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" data-alert-action="G" data-alert-id={s.id} className="rounded bg-emerald-500 px-2 py-1.5 text-[11px] font-black">G · GREEN</button>
                <button type="button" data-alert-action="G1" data-alert-id={s.id} disabled={!s.gale1Liberado} title={!s.gale1Liberado ? `Bloqueado: ${s.motivoHostil}` : "Registrar Gale 1 GREEN"} className="rounded bg-amber-400 px-2 py-1.5 text-[11px] font-black text-black disabled:cursor-not-allowed disabled:opacity-30">G1 · GALE 1</button>
              </div>
            )}
            {aberto === s.id && <div className="mt-2 space-y-2 rounded-lg border border-border bg-background p-3">
              <div className="font-black">{s.title} · {s.confidence}%</div>
              <div><b>Gatilho:</b> {s.sequenceContext ?? s.message}</div>
              <div><b>Entrada:</b> {s.mainAction} · <b>Stake:</b> {s.gale1Stake ? s.gale1Stake.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}) : "—"}</div>
              <div><b>Portão:</b> {s.observacaoHostil ? "👁 OBSERVAÇÃO" : s.gale1Liberado ? "🔓 GALE 1 LIBERADO" : `🔒 GALE 1 BLOQUEADO (${s.motivoHostil})`}</div>
              <div><b>Resultado:</b> {s.auditResult === "INVALID" ? "-" : s.auditResult === "NO_BET" ? "⏸ SEM APOSTA" : s.auditResult === "NA" ? "n/a" : s.auditResult}</div>
              {s.type === "ENTRY_SIGNAL" && !s.observacaoHostil && s.confidence >= 78 && <div className="grid grid-cols-2 gap-2 pt-2">
                <button type="button" data-alert-action="G" data-alert-id={s.id} className="rounded bg-emerald-500 px-2 py-2 font-black">G · GREEN</button>
                <button type="button" disabled={!s.gale1Liberado} data-alert-action="G1" data-alert-id={s.id} className="rounded bg-amber-400 px-2 py-2 font-black disabled:opacity-30">G1 · GALE 1</button>
              </div>}
            </div>}
          </li>
        ))}
      </ul>
    </section>
  );
}
