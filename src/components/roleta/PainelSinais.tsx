import type { Sinal } from "@/lib/roleta/engine";

const STATUS_CORES: Record<Sinal["auditResult"], string> = {
  GREEN: "#28a745",
  RED: "#dc3545",
  NEUTRAL: "#6c757d",
  PARTIAL: "#ffc107",
};

const STATUS_LABEL: Record<Sinal["auditResult"], string> = {
  GREEN: "GREEN",
  RED: "RED",
  NEUTRAL: "NEUTRO",
  PARTIAL: "PARCIAL",
};

const PRIORIDADE: Record<Sinal["priority"], string> = {
  CRITICAL: "CRÍTICA",
  HIGH: "ALTA",
  MEDIUM: "MÉDIA",
  LOW: "BAIXA",
};

export function StatusTag({ status }: { status: string }) {
  const cores: Record<string, string> = {
    PENDENTE: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
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
  const greens = sinais.filter((s) => s.auditResult === "GREEN").length;
  const resolvidos = sinais.filter((s) => s.auditResult !== "NEUTRAL").length;
  const assertividade = sinais.length ? (greens / sinais.length) * 100 : 0;

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-sinal/15 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-black tracking-widest text-sinal">SINAIS ATIVOS</h2>
          <span className="rounded bg-background/70 px-2 py-0.5 text-[10px] font-black">
            ASSERTIVIDADE: {assertividade.toFixed(1)}%
          </span>
        </div>
        <div className="mt-1 text-[9px] text-muted-foreground">
          {greens} GREEN / {resolvidos} resolvidos / {sinais.length} sinais
        </div>
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
            <div className="mt-2 flex items-center justify-between gap-2">
              <span
                className="rounded px-2 py-0.5 text-[10px] font-black text-white"
                style={{ backgroundColor: STATUS_CORES[s.auditResult] }}
              >
                {STATUS_LABEL[s.auditResult]}
              </span>
              {s.auditMessage && (
                <span className="text-[10px] font-semibold" style={{ color: STATUS_CORES[s.auditResult] }}>
                  {s.auditMessage}
                </span>
              )}
            </div>
            <div className="mt-0.5 text-muted-foreground">
              {s.bip === "timer" ? "BT" : "BR"} · rodada anterior {s.rodadaAnterior ?? "—"} (nº {s.numeroAnterior ?? "—"}) · atual {s.rodada} (nº {s.numero})
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
