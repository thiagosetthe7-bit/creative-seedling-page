import type { Estatisticas, Sinal } from "./engine";
import { useEstado } from "./store";

/**
 * RESET DE ESTRATÉGIAS:
 * Compatibilidade de tipos para telas legadas, sem carregar ou executar o engine.
 * Histórico de giros, classificação e marcações BT/BR permanecem no store.
 */
export function useSinais() {
  const estado = useEstado();
  const sinais: Sinal[] = [];
  const integridade = {
    falhas: [] as { id: string; e: string }[],
    pendentes: 0,
    orfaos: 0,
    total: 0,
    ok: true,
  };
  const estatisticas: Estatisticas = {
    total: 0,
    win: 0,
    red: 0,
    partial: 0,
    score: 0,
    pendentes: 0,
    cancelados: 0,
    taxaWin: 0,
    taxaRed: 0,
    maiorSeqWin: 0,
    maiorSeqRed: 0,
    ultimo: null,
  };

  return {
    sinais,
    integridade,
    estatisticas,
    naoVistos: sinais,
    confirmados: estado.confirmados,
  };
}
