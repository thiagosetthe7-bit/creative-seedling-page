import { gerarLogAuditoriaCSV, type Sinal } from "@/lib/roleta/engine";
import { useCallback, useState } from "react";
import { registerBancaResult, registerBancaGale1 } from "./GerenciadorBanca";

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
  const inoperante = sinais.some((s) => s.auditMessage?.includes("AVALIADOR INOPERANTE"));
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
      <div className="border-b border-border bg-sinal/15 px-3 py-2">{inoperante && <div className="mb-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-2 text-xs font-black text-amber-300">⚠️ AVALIADOR INOPERANTE — resultados suspensos, não opere</div>}
        <div className="flex items-center justify-between gap-2"><h2 className="text-xs font-black tracking-widest text-sinal">ALERTAS BIP</h2><button type="button" onClick={exportarCSV} className="rounded border border-border px-2 py-1 text-[10px] font-bold text-muted-foreground hover:text-foreground">EXPORTAR CSV</button></div>
      </div>
      <ul className="max-h-[520px] divide-y divide-border overflow-auto">
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
              <div className="mt-0.5 text-muted-foreground">{s.bip === "timer" ? "BT" : "BR"} · entrada: {s.mainAction} · resultado: {s.auditNumero ?? "—"} · {s.auditResult === "NO_BET" ? "⏸ SEM APOSTA" : s.auditResult === "GREEN" ? "✅ GREEN" : s.auditResult === "RED" ? "❌ RED" : s.auditResult === "INVALID" ? "⚠️ -" : s.auditResult === "PARTIAL" ? "🟡 PARTIAL" : "⏳ AGUARDANDO RESULTADO"}</div>
            </button>
            {aberto === s.id && <div className="mt-2 space-y-2 rounded-lg border border-border bg-background p-3">
              <div className="font-black">{s.title} · {s.confidence}%</div>
              <div><b>Gatilho:</b> {s.sequenceContext ?? s.message}</div>
              <div><b>Entrada:</b> {s.mainAction} · <b>Stake:</b> {s.gale1Stake ? s.gale1Stake.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}) : "—"}</div>
              <div><b>Portão:</b> {s.observacaoHostil ? "👁 OBSERVAÇÃO" : s.gale1Liberado ? "🔓 GALE 1 LIBERADO" : `🔒 GALE 1 BLOQUEADO (${s.motivoHostil})`}</div>
              <div><b>Resultado:</b> {s.auditResult === "INVALID" ? "-" : s.auditResult === "NO_BET" ? "n/a" : s.auditResult}</div>
              {s.type === "ENTRY_SIGNAL" && !s.observacaoHostil && s.confidence >= 78 && <div className="grid grid-cols-2 gap-2 pt-2">
                <button type="button" onClick={() => registerBancaResult(true)} className="rounded bg-emerald-500 px-2 py-2 font-black">G · GREEN</button>
                <button type="button" disabled={!s.gale1Liberado} onClick={() => registerBancaGale1()} className="rounded bg-amber-400 px-2 py-2 font-black disabled:opacity-30">G1 · GALE 1</button>
              </div>}
            </div>}
          </li>
        ))}
      </ul>
    </section>
  );
}
