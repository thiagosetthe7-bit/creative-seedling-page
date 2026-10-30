import type { Spin } from "./catalogo";

/** Compatibilidade temporária: a avaliação automática de sessão foi desativada. */
export type SessionStatus = "OPEN" | "CLOSED" | "TRANSITION";
export interface SessionAssessment {
  sessionStatus: SessionStatus;
  sampleSize: number;
  repeatedAreaTransitions: number;
  message: string;
}

export function evaluateSession(spins: Spin[]): SessionAssessment {
  return {
    sessionStatus: "OPEN",
    sampleSize: spins.length,
    repeatedAreaTransitions: 0,
    message: "",
  };
}
