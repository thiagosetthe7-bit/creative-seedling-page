import { avaliarEntrada, normalizarEntrada, type AvaliadorResultado } from "@/lib/roleta/engine";

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

/**
 * Resolve automaticamente o 1º giro e, quando permitido, o GALE 1.
 * Regra temporal: indiceSinal aponta para o giro que gerou o alerta;
 * indiceSinal + 1 é o primeiro giro avaliado e +2 é o GALE 1.
 */
export function resolverPendentes(alertas: Alerta[], catalogacao: number[]): Alerta[] {
  return alertas.map((a) => {
    if (!a.entrada) return a;
    if (a.resultado != null) return a;

    const r1 = catalogacao[a.indiceSinal + 1];
    if (r1 == null) return a;

    // Zero não é GREEN/RED: é giro sem aposta.
    if (r1 === 0) {
      return {
        ...a,
        resultado: null,
        numeroResultado: 0,
        numeroGale: null,
        desfecho: null,
      };
    }

    const entrada = normalizarEntrada(a.entrada);
    const m1: AvaliadorResultado = avaliarEntrada(
      entrada,
      r1,
      a.ehApostaAtiva && a.regime === "LIMPA" ? "APOSTA_ATIVA" : "OBSERVACAO",
    );

    if (m1 === "GREEN") {
      return {
        ...a,
        resultado: "GREEN",
        numeroResultado: r1,
        numeroGale: null,
        desfecho: "GREEN_DIRETO",
      };
    }

    // Só aposta ativa em regime LIMPA pode avançar automaticamente para GALE 1.
    const r2 = catalogacao[a.indiceSinal + 2];
    if (a.ehApostaAtiva && a.regime === "LIMPA" && r2 != null && r2 !== 0) {
      const m2: AvaliadorResultado = avaliarEntrada(entrada, r2, "APOSTA_ATIVA");
      if (m2 === "GREEN") {
        return {
          ...a,
          resultado: "RED",
          numeroResultado: r1,
          numeroGale: r2,
          desfecho: "GREEN_GALE1",
        };
      }
    }

    return {
      ...a,
      resultado: "RED",
      numeroResultado: r1,
      numeroGale: r2 ?? null,
      desfecho: "FALHA",
    };
  });
}
