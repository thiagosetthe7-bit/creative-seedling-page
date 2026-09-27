import { autoTestResolver, gerarLogAuditoriaCSV, type Sinal } from "@/lib/roleta/engine";
import { acoes } from "@/lib/roleta/store";
import { useCallback, useEffect, useRef, useState } from "react";

export function StatusTag({ status }: { status: string }) {
  const cores: Record<string, string> = {
    AWAITING: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
    AGUARDANDO_RESULTADO: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
    NO_BET: "bg-muted text-muted-foreground",
    NA: "bg-muted text-muted-foreground",
    WIN: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    GREEN: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    RED: "bg-red-500/20 text-red-700 dark:text-red-300",
    INVALID: "bg-red-500/20 text-red-700 dark:text-red-300",
  };
  return <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${cores[status] ?? "bg-muted text-muted-foreground"}`}>{status}</span>;
}

export function PainelSinais({ sinais }: { sinais: Sinal[] }) {
  const [selfTest, setSelfTest] = useState(() => autoTestResolver());
  const containerRef = useRef<HTMLUListElement | null>(null);

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
      const button = target.closest<HTMLButtonElement>("[data-alert-action][data-alert-id]");
      if (!button || button.disabled) return;

      const id = button.dataset.alertId;
      const action = button.dataset.alertAction;
      if (!id) return;

      const sinal = sinais.find((s) => s.id === id);
      if (!sinal) return;

      if (action === "G") {
        acoes.marcarVisto(id);
        window.dispatchEvent(new CustomEvent("roleta:banca-result", { detail: { isWin: true, signalId: id, source: "alert-row" } }));
      }

      if (action === "G1" && sinal.gale1Liberado) {
        acoes.marcarVisto(id);
        window.dispatchEvent(new CustomEvent("roleta:banca-gale1", { detail: { signalId: id, source: "alert-row" } }));
      }

      window.dispatchEvent(new CustomEvent("roleta:resolver-run", { detail: { signalId: id, action } }));
      button.classList.add("ring-2");
      window.setTimeout(() => button.classList.remove("ring-2"), 250);
    };

    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [sinais]);

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

  const falhaResolver = sinais.some((s) =>
    s.type === "ENTRY_SIGNAL" &&
    !s.observacaoHostil &&
    s.numeroSeguinte !== null &&
    ["AWAITING", "INVALID"].includes(s.auditResult)
  );

  const lista = [...sinais].reverse().slice(0, 20);

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-3 py-2">
        {(!selfTest.ok || falhaResolver) && (
          <div className="mb-2 rounded border border-red-500/50 bg-red-500/10 px-2 py-2 text-xs font-black text-red-400">
            ⚠️ FALHA DE RESOLUÇÃO: o avaliador/resolver não concluiu uma aposta ativa. Verifique o diagnóstico técnico.
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-black tracking-widest">ALERTAS BIP</h2>
          <button type="button" onClick={exportarCSV} className="rounded border border-border px-2 py-1 text-[10px] font-bold text-muted-foreground hover:text-foreground">EXPORTAR CSV</button>
        </div>
      </div>

      <ul ref={containerRef} className="max-h-[520px] divide-y divide-border overflow-auto">
        {lista.length === 0 && <li className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhum BIP com alerta detectado.</li>}

        {lista.map((s) => (
          <li key={s.id} className="px-3 py-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <strong>{s.title}</strong>
              <StatusTag status={s.auditResult === "GREEN" ? "GREEN" : s.auditResult === "RED" ? "RED" : s.auditResult === "NO_BET" ? "NO_BET" : s.auditResult === "NA" ? "NA" : "AWAITING"} />
            </div>

            <div className="mt-1 font-semibold">{s.mainAction}</div>
            <div className="mt-1 text-muted-foreground">
              {s.auditNumero == null
                ? s.auditResult === "NO_BET" ? "⏸ SEM APOSTA" : s.auditResult === "NA" ? "n/a" : "⏳ AGUARDANDO"
                : `${s.auditNumero} → ${s.auditResult === "GREEN" ? "✅ GREEN" : "❌ RED"}`}
            </div>

            {s.type === "ENTRY_SIGNAL" && !s.observacaoHostil && s.confidence >= 78 && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" data-alert-action="G" data-alert-id={s.id} className="rounded bg-emerald-500 px-2 py-1.5 text-[11px] font-black">G · GREEN</button>
                <button type="button" data-alert-action="G1" data-alert-id={s.id} disabled={!s.gale1Liberado} title={!s.gale1Liberado ? "GALE 1 bloqueado" : "Registrar GALE 1"} className="rounded bg-amber-400 px-2 py-1.5 text-[11px] font-black text-black disabled:cursor-not-allowed disabled:opacity-30">G1 · GALE 1</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
