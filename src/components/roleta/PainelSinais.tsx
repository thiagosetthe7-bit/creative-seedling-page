import { gerarLogAuditoriaCSV, type Sinal } from "@/lib/roleta/engine";
import { useCallback } from "react";

const PRIORIDADE: Record<Sinal["priority"], string> = {
  CRITICAL: "CRÍTICA",
  HIGH: "ALTA",
  MEDIUM: "MÉDIA",
  LOW: "BAIXA",
};

export function StatusTag({ status }: { status: string }) {
  const cores: Record<string, string> = {
    AGUARDANDO_RESULTADO: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
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
            <div className="flex items-center justify-between gap-2">
              <span className="font-black">{s.title}</span>
              <span className="rounded px-2 py-0.5 text-[10px] font-black text-white" style={{ backgroundColor: s.colorCode }}>
                {PRIORIDADE[s.priority]}
              </span>
            </div>
            <div className="mt-1 font-semibold">{s.message}</div>
            <div className="mt-0.5 text-muted-foreground">
              {s.bip === "timer" ? "BT" : "BR"} · entrada: {s.mainAction} · resultado: {s.auditNumero ?? "—"} · {s.auditResult === "GREEN" ? `✅ GREEN (${s.auditTimestamp ? new Date(s.auditTimestamp).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) : "--:--"})` : s.auditResult === "RED" ? `❌ RED (${s.auditTimestamp ? new Date(s.auditTimestamp).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) : "--:--"})` : s.auditResult === "PARTIAL" ? `🟡 PARTIAL (${s.auditTimestamp ? new Date(s.auditTimestamp).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) : "--:--"})` : "⏳ AGUARDANDO RESULTADO"}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
