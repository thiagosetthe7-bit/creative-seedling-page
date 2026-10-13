import { rotuloConfianca, type StatsPadrao } from "./padroes";
import { CONFIG } from "./config";
export type Stats = StatsPadrao;
export function mensagemPopup(o:{estrategia:string;stats:Stats;regime:"LIMPA"|"HOSTIL";motivoHostil?:string;rebaixadoPorRegime:boolean;galeLiberado:boolean}){
 const confianca=rotuloConfianca(o.stats);
 const taxa=o.stats.n>0?o.stats.greens/o.stats.n:0;
 const apostar=(o.stats.n<CONFIG.N_VALIDAR||taxa>=CONFIG.PISO_MODERADO)&&o.regime==="LIMPA"&&!o.rebaixadoPorRegime;
 const stake=o.stats.n<CONFIG.N_VALIDAR?0.25:taxa>=CONFIG.PISO_FORTE?1:taxa>=CONFIG.PISO_MODERADO?0.5:0;
 const decisao=apostar?(o.stats.n<CONFIG.N_VALIDAR?"⚠️ ENTRADA COM STAKE MÍNIMA · 0,25x (medindo)":"✅ ENTRADA CONFIRMADA · stake "+stake+"x"):`⛔ NÃO APOSTAR · registrar apenas${o.regime==="HOSTIL"?` (janela hostil: ${o.motivoHostil})`:o.rebaixadoPorRegime?" (rebaixado pelo regime)":" (medição ainda insuficiente ou abaixo do piso)"}`;
 const gale=apostar?(o.galeLiberado?"🔁 GALE 1: LIBERADO":`🔒 GALE 1: BLOQUEADO (${o.motivoHostil||"regime"})`):"🔁 GALE 1: N/A (sem entrada)";
 const resumo=`🎯 Gatilho: ${o.estrategia} · ${confianca} · ${apostar?"entrada CONFIRMADA":"NÃO apostar"}`;
 return{resumo,linhas:{gatilho:o.estrategia,confianca,regime:o.regime==="LIMPA"?"🌡️ JANELA LIMPA":`⚠️ JANELA HOSTIL (${o.motivoHostil})`,decisao,gale}};
}
