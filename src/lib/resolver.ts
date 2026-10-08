import { avaliarEntrada, atributos, normalizarEntrada } from './avaliador';
import { CONFIG } from './config';

export type Desfecho='GREEN_DIRETO'|'GREEN_GALE1'|'FALHA_GIRO1'|'FALHA_GALE'|null;
export interface AlertaBase{id:string;entrada:string;estrategia:string;indiceSinal:number;regime:'LIMPA'|'HOSTIL';observacao:boolean;padrao?:string}

export function computarDesfecho(a:AlertaBase,cat:number[]){
  const r1=cat[a.indiceSinal+1];
  if(r1==null)return{resultado:null,n1:null,n2:null,desfecho:null as Desfecho};
  if(r1===0)return{resultado:null,n1:0,n2:null,desfecho:null as Desfecho};
  if(avaliarEntrada(a.entrada,r1)==='GREEN')return{resultado:'GREEN' as const,n1:r1,n2:null,desfecho:'GREEN_DIRETO' as Desfecho};
  if(a.regime==='HOSTIL'||(a.observacao&&CONFIG.OSC_RET_APENAS_OBSERVACAO))return{resultado:'RED' as const,n1:r1,n2:null,desfecho:'FALHA_GIRO1' as Desfecho};
  const r2=cat[a.indiceSinal+2];
  if(r2==null)return{resultado:'RED' as const,n1:r1,n2:null,desfecho:null as Desfecho};
  if(r2===0)return{resultado:'RED' as const,n1:r1,n2:0,desfecho:'FALHA_GALE' as Desfecho};
  return avaliarEntrada(a.entrada,r2)==='GREEN'
    ?{resultado:'RED' as const,n1:r1,n2:r2,desfecho:'GREEN_GALE1' as Desfecho}
    :{resultado:'RED' as const,n1:r1,n2:r2,desfecho:'FALHA_GALE' as Desfecho};
}

export function formatResultado(a:AlertaBase,cat:number[]){
  const r=computarDesfecho(a,cat);
  if(r.n1==null)return'aguardando…';
  if(r.n1===0)return'0 · ⏸ sem aposta';
  const at1=atributos(r.n1);
  const first=`${r.n1} (${at1.cor},${at1.alt}) → ${r.resultado==='GREEN'?'✅ GREEN':'❌ PERDEU'}`;
  if(r.resultado==='GREEN'||a.regime==='HOSTIL'||a.observacao)return first;
  if(r.n2==null)return`${first} · aguardando G1…`;
  const at2=atributos(r.n2);
  return `${first} · G1: ${r.n2} (${at2.cor},${at2.alt}) → ${r.desfecho==='GREEN_GALE1'?'✅ GREEN no GALE 1':'❌ PERDEU'}`;
}
