import type { Alerta } from "@/lib/resolver";

const curta = (e: string) => e.replace(/^(ENTRAR EM|ENTRADA:)\s*/i, "");

export function AlertaRow({ a, onOverride }: {
  a: Alerta;
  onOverride: (id: string, d: "GREEN_DIRETO" | "GREEN_GALE1" | "FALHA") => void;
}) {
  const res =
    a.numeroResultado == null
      ? "aguardando…"
      : a.numeroResultado === 0
        ? "0 · ⏸ sem aposta"
        : `${a.numeroResultado} → ${a.resultado === "GREEN" ? "✅ GREEN" : "❌ RED"}`;

  const gale =
    a.desfecho === "GREEN_GALE1"
      ? ` · GALE 1: ${a.numeroGale} → ✅ GREEN NO GALE 1`
      : a.desfecho === "FALHA" && a.numeroGale != null
        ? ` · GALE 1: ${a.numeroGale} → ❌ PERDA`
        : "";

  return (
    <div className="alerta-row">
      <div className="l1">
        <strong>ENTRADA: {curta(a.entrada)}</strong>
        <span className="tag">gatilho: {a.estrategia}</span>
        {a.regime === "HOSTIL" && <span className="pill-hostil">⚠ hostil</span>}
      </div>
      <div className="l2">
        <span>resultado: {res}{gale}</span>
        <span className="botoes">
          <button type="button" className="btn-green" onClick={() => onOverride(a.id, "GREEN_DIRETO")}>GREEN</button>
          <button type="button" className="btn-gale" onClick={() => onOverride(a.id, "GREEN_GALE1")}>GALE 1</button>
          <button type="button" className="btn-perdi" onClick={() => onOverride(a.id, "FALHA")}>PERDI</button>
        </span>
      </div>
    </div>
  );
}
