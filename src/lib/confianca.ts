export interface Stats{ pct:number; n:number }
export const MIN_N = 20, PISO_FORTE = 78, PISO_MODERADO = 70;

export function tier(s:Stats):'NAO_VALIDADO'|'FORTE'|'MODERADO'|'ABAIXO_PISO'{
  if(s.n < MIN_N) return 'NAO_VALIDADO';
  if(s.pct >= PISO_FORTE) return 'FORTE';
  if(s.pct >= PISO_MODERADO) return 'MODERADO';
  return 'ABAIXO_PISO';
}

// stats vem do Relatórios/log: {pct, n} de sequências resolvidas por estratégia.
export function mensagemPopup(o:{
  estrategia:string; stats:Stats; regime:'LIMPA'|'HOSTIL'; motivoHostil?:string;
  rebaixadoPorRegime:boolean; galeLiberado:boolean;
}){
  const t = tier(o.stats);
  const valido = t==='FORTE'||t==='MODERADO';
  const apostar = valido && o.regime==='LIMPA' && !o.rebaixadoPorRegime;

  const confianca =
    t==='NAO_VALIDADO' ? `amostra pequena (${o.stats.n} sinais) · AINDA NÃO VALIDADO por porcentagem`
    : t==='FORTE'      ? `${o.stats.pct}% em ${o.stats.n} sinais · padrão FORTE (validado)`
    : t==='MODERADO'   ? `${o.stats.pct}% em ${o.stats.n} sinais · padrão MODERADO (no limite)`
    :                    `${o.stats.pct}% em ${o.stats.n} sinais · ABAIXO DO PISO`;

  const decisao = apostar
    ? `✅ ENTRADA CONFIRMADA`
    : `⛔ NÃO APOSTAR · registrar apenas${o.regime==='HOSTIL' ? ` (janela hostil: ${o.motivoHostil})` : o.rebaixadoPorRegime ? ' (rebaixado pelo regime)' : ''}`;

  const gale = apostar
    ? (o.galeLiberado ? '🔁 GALE 1: LIBERADO' : `🔒 GALE 1: BLOQUEADO (${o.motivoHostil||'regime'})`)
    : '🔁 GALE 1: N/A (sem entrada)';

  const resumo = `🎯 Gatilho: ${o.estrategia} · ${confianca} · ${apostar?'entrada CONFIRMADA':'NÃO apostar'} · ${o.galeLiberado&&apostar?'gale LIBERADO':'gale '+(apostar?'BLOQUEADO':'N/A')}`;

  return { resumo, linhas:{ gatilho:o.estrategia, confianca, regime:o.regime==='LIMPA'?'🌡️ JANELA LIMPA':`⚠️ JANELA HOSTIL (${o.motivoHostil})`, decisao, gale } };
}
