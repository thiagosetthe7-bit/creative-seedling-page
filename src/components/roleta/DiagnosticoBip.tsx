import { useMemo } from "react";
import { analisarBips, agregar, gerarLogBipCSV, textoResumo, type RowBip } from "@/lib/loggerBip";
import type { Spin } from "@/lib/roleta/engine";
import type { EstadoApp } from "@/lib/roleta/store";

export function DiagnosticoBip({ spins, bips }: Pick<EstadoApp, "spins"|"bips">) {
  const { resumo, eventos } = useMemo(() => {
    const rows: RowBip[] = spins.map((s) => ({
      n: s.numero,
      bip: bips[s.id] === "timer" ? "BT" : bips[s.id] === "rolando" ? "BR" : null,
    }));
    const eventos = analisarBips(rows);
    return { eventos, resumo: textoResumo(agregar(eventos)) };
  }, [spins, bips]);

  const exportar = () => {
    const blob = new Blob([gerarLogBipCSV(eventos)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diagnostico-bip.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <details className="rounded-lg border border-border bg-card p-3">
      <summary className="cursor-pointer text-xs font-black tracking-widest">DIAGNÓSTICO BIP</summary>
      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
        <div>{resumo.BR}</div>
        <div>{resumo.BT}</div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span>{eventos.length} eventos observados</span>
          <button onClick={exportar} className="rounded border border-border px-2 py-1 text-[10px] font-bold hover:bg-accent">
            EXPORTAR CSV
          </button>
        </div>
      </div>
    </details>
  );
}
