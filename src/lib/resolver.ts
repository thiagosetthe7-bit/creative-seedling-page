import { avaliarEntrada } from "./avaliador";

export type Desfecho = "GREEN_DIRETO" | "GREEN_GALE1" | "FALHA" | null;

export interface Alerta {
  id: string;
  entrada: string;
  estrategia: string;
  indiceSinal: number;
  regime: "LIMPA" | "HOSTIL";
  resultado: "GREEN" | "RED" | null;
  numeroResultado: number | null;
  numeroGale: number | null;
  desfecho: Desfecho;
  ehApostaAtiva: boolean;
}

export function resolverPendentes(alertas: Alerta[], cat: number[]): Alerta[] {
  return alertas.map((a) => {
    if (!a.entrada || a.resultado != null) return a;

    const r1 = cat[a.indiceSinal + 1];
    if (r1 == null) return a;

    if (r1 === 0) {
      return { ...a, resultado: null, numeroResultado: 0, numeroGale: null, desfecho: null };
    }

    const m1 = avaliarEntrada(a.entrada, r1);
    if (m1 === "GREEN") {
      return { ...a, resultado: "GREEN", numeroResultado: r1, numeroGale: null, desfecho: "GREEN_DIRETO" };
    }

    const r2 = cat[a.indiceSinal + 2];
    if (a.ehApostaAtiva && a.regime === "LIMPA" && r2 != null && r2 !== 0 && avaliarEntrada(a.entrada, r2) === "GREEN") {
      return { ...a, resultado: "RED", numeroResultado: r1, numeroGale: r2, desfecho: "GREEN_GALE1" };
    }

    return { ...a, resultado: "RED", numeroResultado: r1, numeroGale: r2 ?? null, desfecho: "FALHA" };
  });
}
