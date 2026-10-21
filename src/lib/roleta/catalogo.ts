import { classificar, type Classificacao } from "./classificacao";

/** Registro básico de giro; não depende do motor de estratégias. */
export interface Spin {
  id: string;
  numero: number;
  timestamp: number;
  classificacao: Classificacao;
  rodada?: number;
}

/** Cria apenas o registro e seus atributos de catalogação, sem detectar sinais. */
export function criarSpin(numero: number, timestamp = Date.now()): Spin {
  return {
    id: `${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    numero,
    timestamp,
    classificacao: classificar(numero),
  };
}
