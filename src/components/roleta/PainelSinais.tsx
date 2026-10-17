import { gerarLogAuditoriaCSV, type Sinal } from "@/lib/roleta/engine";
import { acoes, useEstado } from "@/lib/roleta/store";
import { baixarCSVCatalogacao } from "@/lib/exportCatalogacao";
import { linhaEntrada, rotuloAlerta } from "@/lib/labels";
import { useCallback, useRef } from "react";

export function StatusTag({ status }: { status: string }) {
  const cores: Record<string, string> = {
    AWAITING: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
    AGUARDANDO_RESULTADO: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
    WIN: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    GREEN: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    RED: "bg-red-500/20 text-red-700 dark:text-red-300",
    PARTIAL: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
    NO_BET: "bg-muted text-muted-foreground",
    NA: "bg-muted text-muted-foreground",
    INVALID: "bg-red-500/20 text-red-700 dark:text-red-300",
  };
  return <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${cores[status] ?? "bg-muted text-muted-foreground"}`}>{status}</span>;
}

function resultadoVisual(s: Sinal) {
  if (s.auditResult === "NO_BET") return "⏸ PAUSA · ZERO (fora da contagem)";
  if (s.auditNumero == null) return s.auditResult === "NA" ? "n/a" : "⏳ AGUARDANDO";
  const primeiro = `${s.auditNumero} → ${s.auditResult === "GREEN" ? "✅ GREEN" : "❌ RED"}`;
  if (s.auditResult === "GREEN" || s.observacaoHostil || !s.gale1Liberado) return primeiro;
  if (s.gale1Usado) return `${primeiro} · ${s.gale1Resultado === "GREEN" ? "GALE 1 → ✅ GREEN" : "GALE 1 → ❌ RED"}`;
  if (s.auditResult === "RED") return `${primeiro} · aguardando G1…`;
  return primeiro;
}

export function PainelSinais({ sinais }: { sinais: Sinal[]; integridade?: { falhas: { id: string; e: string }[]; pendentes: number; orfaos: number; total: number; ok: boolean } }) {
export function PainelSinais({ sinais }: { sinais: Sinal[]; integridade?: { falhas: { id: string; e: string }[]; pendentes: number; orfaos: number; total: number; ok: boolean } }) {
  const containerRef = useRef<HTMLUListElement | null>(null);
  const { spins, bips } = useEstado();

  const exportarCSV = useCallback(() => {
    baixarCSVCatalogacao(spins, bips);
  }, [spins, bips]);


  const lista = [...sinais].reverse().slice(0, 20);

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-3 py-2">
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
              <strong>{rotuloAlerta({ estrategia: s.title.replace(/^👁\s*OBSERVAÇÃO\s*·\s*/i, "") })}</strong>
              <StatusTag status={s.auditResult === "GREEN" ? "GREEN" : s.auditResult === "RED" ? "RED" : s.auditResult} />
            </div>

            <div className="mt-1 font-semibold">{linhaEntrada({ entrada: s.mainAction })}</div>
            <div className="mt-1 text-muted-foreground">PADRÃO: {s.footerNote || s.sequenceContext || s.title}</div>
            <div className="mt-1 text-muted-foreground">CONFIANÇA: {s.message || "medindo..."}</div>
            <div className="mt-1 text-muted-foreground">{resultadoVisual(s)}</div>

            {s.type === "ENTRY_SIGNAL" && s.confidence > 0 && (
              <div className="mt-2 text-[10px] font-bold text-muted-foreground">
                {s.gale1Liberado ? "GALE 1 LIBERADO" : "GALE 1 BLOQUEADO · HOSTIL"}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
