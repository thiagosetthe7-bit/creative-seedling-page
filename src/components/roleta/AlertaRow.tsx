import type { Alerta } from "@/lib/resolver";

interface Props {
  alerta: Alerta;
  stakeBase: number;
  onDesfecho: (id: string, d: Alerta["desfecho"]) => void;
}

const curta = (e: string) => e.replace(/^(ENTRAR EM|ENTRADA:)\s*/i, "");

export function AlertaRow({ alerta: a, stakeBase, onDesfecho }: Props) {
  const resultado =
    a.numeroResultado == null ? "aguardando…" :
    a.resultado == null ? a.regime === "HOSTIL" ? "n/a" : a.numeroResultado + " · ⏸ sem aposta" :
    a.numeroResultado + " → " + (a.resultado === "GREEN" ? "✅ GREEN" : "❌ RED");

  return (
    <div className="alerta-row">
      <div className="alerta-l1">
        <strong>ENTRADA: {curta(a.entrada)}</strong>
        <span className="tag">gatilho: {a.estrategia}</span>
        {a.regime === "HOSTIL" && <span className="pill-hostil" title="A ferramenta não recomendou apostar">⚠ hostil</span>}
      </div>
      <div className="alerta-l2">
        <span>resultado: {resultado}</span>
        {a.regime === "LIMPA" && (
          <span className="alerta-botoes">
            <button type="button" onClick={() => onDesfecho(a.id, "GREEN_DIRETO")}>✅ GREEN</button>
            <button type="button" onClick={() => onDesfecho(a.id, "GREEN_GALE1")}>🔁 GALE 1</button>
            <button type="button" onClick={() => onDesfecho(a.id, "FALHA_GIRO1")}>❌ PERDI</button>
            <button type="button" onClick={() => onDesfecho(a.id, "FALHA_GALE1")}>− GALE</button>
          </span>
        )}
      </div>
      {a.desfecho && <div className="alerta-perda">Desfecho: {a.desfecho} · stake R$ {stakeBase.toFixed(2)}</div>}
    </div>
  );
}
