import { avaliarEntrada, normalizarEntrada, type AvaliadorResultado } from "@/lib/roleta/engine";

export interface Alerta {
  id: string;
  entrada: string;
  estrategia: string;
  indiceSinal: number;
  regime: "LIMPA" | "HOSTIL";
  resultado: "GREEN" | "RED" | null;
  numeroResultado: number | null;
  desfecho: "GREEN_DIRETO" | "GREEN_GALE1" | "FALHA_GIRO1" | "FALHA_GALE1" | null;
}

export function resolverPendentes(alertas: Alerta[], catalogacao: number[]): Alerta[] {
  return alertas.map((a) => {
    if (!a.entrada || a.resultado !== null) return a;
    const proximo = catalogacao[a.indiceSinal + 1];
    if (proximo == null) return a;

    const entrada = normalizarEntrada(a.entrada);
    const r: AvaliadorResultado = avaliarEntrada(entrada, proximo, a.regime === "HOSTIL" ? "OBSERVACAO" : "APOSTA_ATIVA");

    if (r !== "GREEN" && r !== "RED") return { ...a, numeroResultado: proximo };
    return { ...a, resultado: r, numeroResultado: proximo };
  });
}
