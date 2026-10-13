import { rotuloConfianca, type StatsPadrao } from "./padroes";
import { CONFIG } from "./config";
export type Stats = StatsPadrao;
export function mensagemPopup(o:{estrategia:string;stats:Stats;regime:"LIMPA"|"HOSTIL";motivoHostil?:string;rebaixadoPorRegime:boolean;galeLiberado:boolean}){
 const confianca=rotuloConfianca(o.stats);
 const medido=o.stats.n>=CONFIG.N_VALIDAR;
 const apostar=medido&&o.stats.greens/o.stats.n>=CONFIG.PISO_FORTE&&o.regime==="LIMPA"&&!o.rebaixadoPorRegime;
 const decisao=apostar?"✅ ENTRADA CONFIRMADA":`⛔ NÃO APOSTAR · registrar apenas${o.regime==="HOSTIL"?` (janela hostil: ${o.motivoHostil})`:o.rebaixadoPorRegime?" (rebaixado pelo regime)":" (medição ainda insuficiente ou abaixo do piso)"}`;
 const gale=apostar?(o.galeLiberado?"🔁 GALE 1: LIBERADO":`🔒 GALE 1: BLOQUEADO (${o.motivoHostil||"regime"})`):"🔁 GALE 1: N/A (sem entrada)";
 const resumo=`🎯 Gatilho: ${o.estrategia} · ${confianca} · ${apostar?"entrada CONFIRMADA":"NÃO apostar"}`;
 return{resumo,linhas:{gatilho:o.estrategia,confianca,regime:o.regime==="LIMPA"?"🌡️ JANELA LIMPA":`⚠️ JANELA HOSTIL (${o.motivoHostil})`,decisao,gale}};
}
