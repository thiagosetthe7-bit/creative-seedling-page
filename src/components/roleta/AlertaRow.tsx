import type { Alerta } from "@/lib/resolver";

const curta = (e: string) => e.replace(/^(ENTRAR EM|ENTRADA:)\s*/i, "");

function formatResultado(a: Alerta) {
  if (a.numeroResultado == null) return "aguardando…";
  if (a.numeroResultado === 0) return "0 · ⏸ sem aposta";
  const primeiro = `${a.numeroResultado} → ${a.resultado === "GREEN" ? "✅ GREEN" : "❌ RED"}`;
  if (a.resultado === "GREEN" || a.regime === "HOSTIL") return primeiro;
  if (a.numeroGale == null) return `${primeiro} · aguardando G1…`;
  return `${primeiro} · GALE 1: ${a.numeroGale} → ${(a.resultado as string) === "GREEN" ? "✅ GREEN/G1" : "❌ RED/G1"}`;
}

export function AlertaRow({ a }: { a: Alerta }) {
  return (
    <div className="alerta-row">
      <div className="l1">
        <strong>ENTRADA: {curta(a.entrada)}</strong>
        <span className="tag">gatilho: {a.estrategia}</span>
        {a.regime === "HOSTIL" && <span className="pill-hostil">⚠ hostil</span>}
      </div>
      <div className="l2">
        <span>resultado: {formatResultado(a)}</span>
      </div>
    </div>
  );
}
