import { useMemo } from "react";
import { autoTestResolver, autoTestRegimeV14, autoTestSeqObsV14 } from "@/lib/roleta/engine";
import { autoTestResolverV14 } from "@/lib/resolver";
import { autoTestPadroes } from "@/lib/padroes";
import { rodarSelfTest } from "@/lib/avaliador";

type Falha = { id: string; e: string };

export function Diagnostico({
  falhas,
  pendentes,
  orfaos,
}: {
  falhas: Falha[];
  pendentes: number;
  orfaos: number;
}) {
  const st = useMemo(() => {
    const resultados = [
      autoTestResolver(),
      autoTestResolverV14(),
      autoTestRegimeV14(),
      autoTestSeqObsV14(),
      autoTestPadroes(),
    ];
    const avaliador = rodarSelfTest();
    return {
      ok: resultados.every((r) => r.ok) && avaliador.ok,
      falhas: [
        ...resultados.flatMap((r) => r.errors),
        ...avaliador.falhas.map((f) => `avaliador: ${JSON.stringify(f)}`),
      ],
    };
  }, []);

  return (
    <details className="diag rounded border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground">
      <summary className="cursor-pointer font-bold">▸ diagnóstico</summary>
      <div className="mt-2 space-y-1">
        <p>Integridade: {falhas.length} falha(s) real(is) · {pendentes} pendente(s) normal(is) · {orfaos} órfão(s)</p>
        <p>Self-test: {st.ok ? "OK" : `${st.falhas.length} falha(s)`}</p>
        {falhas.map((f) => <p key={f.id}>⚠ {f.id}: inconsistente</p>)}
        {st.falhas.map((f, i) => <p key={`self-${i}`}>⚠ self-test: {f}</p>)}
      </div>
    </details>
  );
}
