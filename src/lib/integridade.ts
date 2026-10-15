import { avaliarEntrada } from "./avaliador";
import type { AlertaBase, Desfecho } from "./resolver";

export type EstadoAlerta = "RESOLVIDO" | "PENDENTE" | "ORFAO" | "FALHA_REAL";

/**
 * Classifica a integridade do ciclo de vida de um alerta com base no catálogo
 * atual. O resultado é derivado, portanto edições e exclusões são refletidas
 * automaticamente na próxima auditoria.
 */
export function estadoDoAlerta(
  a: AlertaBase,
  cat: number[],
  desfecho: Desfecho,
): EstadoAlerta {
  const alvo = a.indiceSinal + 1;
  const gale = a.indiceSinal + 2;

  if (a.indiceSinal < 0 || a.indiceSinal >= cat.length) return "ORFAO";

  // Sem o primeiro giro catalogado, o alerta continua aguardando.
  if (alvo >= cat.length) return desfecho == null ? "PENDENTE" : "FALHA_REAL";

  const r1 = cat[alvo];
  // Zero é pausa; GREEN encerra no giro 1; regime HOSTIL não libera Gale.
  const resolvido1 =
    r1 === 0 ||
    avaliarEntrada(a.entrada, r1) === "GREEN" ||
    a.regime !== "LIMPA" ||
    a.observacao;

  if (resolvido1) return desfecho != null ? "RESOLVIDO" : "FALHA_REAL";

  // O primeiro giro falhou e ainda não há giro de Gale catalogado.
  if (gale >= cat.length) return desfecho == null ? "PENDENTE" : "FALHA_REAL";

  // Primeiro giro e Gale estão catalogados; resultado ausente é falha de integridade.
  return desfecho != null ? "RESOLVIDO" : "FALHA_REAL";
}

export function auditarIntegridade(
  alertas: AlertaBase[],
  cat: number[],
  desfechos: Desfecho[],
) {
  const estados = alertas.map((a, i) => ({
    id: a.id,
    e: estadoDoAlerta(a, cat, desfechos[i] ?? null),
  }));
  const falhas = estados.filter((x) => x.e === "FALHA_REAL");
  const pendentes = estados.filter((x) => x.e === "PENDENTE").length;
  const orfaos = estados.filter((x) => x.e === "ORFAO").length;

  return {
    falhas,
    pendentes,
    orfaos,
    total: estados.length,
    ok: falhas.length === 0,
  };
}
