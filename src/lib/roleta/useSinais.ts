import { calcularEstatisticas, type Sinal } from "./engine";
import { useEstado } from "./store";

/**
 * RESET DE ESTRATÉGIAS:
 * Mantém a interface de compatibilidade usada pelas rotas legadas, mas não
 * executa detectores, resolvers, classificadores de regime nem autotestes de sinais.
 * O histórico persistido no store permanece intacto.
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

  return {
    sinais,
    integridade,
    estatisticas: calcularEstatisticas(sinais),
    naoVistos: sinais,
    confirmados: estado.confirmados,
  };
}
