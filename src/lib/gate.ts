import { estadoDoAlerta } from "./integridade";
import type { AlertaBase, Desfecho } from "./resolver";
import type { Regime } from "./regime";

/** Gate local por alerta; não dispara nem controla banners globais. */
export function gateDoAlerta(
  a: AlertaBase,
  cat: number[],
  desfecho: Desfecho,
  regime: Regime,
): { confirmavel: boolean; aviso: string } {
  const est = estadoDoAlerta(a, cat, desfecho);
  if (est === "FALHA_REAL" || est === "ORFAO") {
    return { confirmavel: false, aviso: "⛔ não confirmado · dado inconsistente" };
  }
  if (regime === "PAUSA") {
    return { confirmavel: false, aviso: "⏸ pausa · zero recente" };
  }
  if (regime === "HOSTIL") {
    return { confirmavel: true, aviso: "🔁 gale bloqueado · janela hostil" };
  }
  return { confirmavel: true, aviso: "" };
}
