import { rotuloConfianca, type StatsPadrao } from './padroes';

export type Stats = StatsPadrao;

export function mensagemPopup(o:{
  estrategia:string; stats:Stats; regime:'LIMPA'|'HOSTIL'; motivoHostil?:string;
  rebaixadoPorRegime:boolean; galeLiberado:boolean;
}){
  const confianca = rotuloConfianca(o.stats);
  const medido = o.stats.n >= 20;
  const apostar = medido && o.regime === 'LIMPA' && !o.rebaixadoPorRegime;

  const decisao = apostar
    ? '✅ ENTRADA CONFIRMADA'
    : `⛔ NÃO APOSTAR · registrar apenas${o.regime==='HOSTIL' ? ` (janela hostil: ${o.motivoHostil})` : o.rebaixadoPorRegime ? ' (rebaixado pelo regime)' : ' (medição ainda insuficiente)'}`;

  const gale = apostar
    ? (o.galeLiberado ? '🔁 GALE 1: LIBERADO' : `🔒 GALE 1: BLOQUEADO (${o.motivoHostil||'regime'})`)
    : '🔁 GALE 1: N/A (sem entrada)';

  const resumo = `🎯 Gatilho: ${o.estrategia} · ${confianca} · ${apostar?'entrada CONFIRMADA':'NÃO apostar'} · ${o.galeLiberado&&apostar?'gale LIBERADO':'gale '+(apostar?'BLOQUEADO':'N/A')}`;

  return { resumo, linhas:{ gatilho:o.estrategia, confianca, regime:o.regime==='LIMPA'?'🌡️ JANELA LIMPA':`⚠️ JANELA HOSTIL (${o.motivoHostil})`, decisao, gale } };
}
