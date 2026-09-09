import type { Sinal } from "@/lib/roleta/engine";

const CORES_STATUS: Record<string, string> = {
  PENDENTE: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  WIN: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  RED: "bg-red-500/20 text-red-700 dark:text-red-300",
  CANCELADO: "bg-muted text-muted-foreground",
};

export function StatusTag({ status }: { status: string }) {
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${CORES_STATUS[status] ?? ""}`}>
      {status}
    </span>
  );
}

export function PainelSinais({ sinais }: { sinais: Sinal[] }) {
  const ultimos = [...sinais].reverse().slice(0, 12);

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-sinal/15 px-3 py-2">
        <h2 className="text-xs font-black tracking-widest text-sinal">SINAIS ATIVOS</h2>
      </div>
      <ul className="max-h-[420px] divide-y divide-border overflow-auto">
        {ultimos.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-muted-foreground">
            Nenhum sinal detectado.
          </li>
        )}
        {ultimos.map((s) => (
          <li key={s.id} className="px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-black">{s.alvo}</span>
              <StatusTag status={s.status} />
            </div>
            <div className="mt-0.5 text-muted-foreground">
              {s.categoriaLabel} · rodada {s.rodada} ·{" "}
              {new Date(s.timestamp).toLocaleTimeString("pt-BR")}
            </div>
            <div className="text-muted-foreground">
              {s.sequenciaInicial}x {s.alvo} → quebra {s.quebra} → retorno {s.retorno}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
