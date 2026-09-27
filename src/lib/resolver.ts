import { avaliarEntrada as avaliarEntradaBase, normalizarEntrada } from './avaliador';

export type Desfecho='GREEN_DIRETO'|'GREEN_GALE1'|'FALHA_GIRO1'|'FALHA_GALE'|null;

export interface Alerta {
  id:string; entrada:string; estrategia:string; indiceSinal:number;
  regime:'LIMPA'|'HOSTIL'; resultado:'GREEN'|'RED'|null;
  numeroResultado:number|null; numeroGale:number|null;
  desfecho:Desfecho; bancaAplicada:boolean;
}

function avaliar(entrada:string, numero:number): 'GREEN'|'RED'|null {
  return avaliarEntradaBase(entrada, numero);
}

export function aplicarResultados(alertas:Alerta[], cat:number[], stakeBase:number){
  let delta=0;
  const novos=alertas.map(a=>{
    if(!a.entrada || a.desfecho!=null || a.bancaAplicada) return a;
    const r1=cat[a.indiceSinal+1]; if(r1==null) return a;
    if(r1===0) return {...a,resultado:null,numeroResultado:0,desfecho:null,bancaAplicada:true};
    const m1=avaliar(a.entrada,r1);
    if(m1==='GREEN'){
      delta+=stakeBase;
      return {...a,resultado:'GREEN',numeroResultado:r1,desfecho:'GREEN_DIRETO',bancaAplicada:true};
    }
    if(a.regime==='HOSTIL'){
      delta-=stakeBase;
      return {...a,resultado:'RED',numeroResultado:r1,desfecho:'FALHA_GIRO1',bancaAplicada:true};
    }
    const r2=cat[a.indiceSinal+2];
    if(r2==null) return {...a,resultado:'RED',numeroResultado:r1,desfecho:null};
    if(r2===0){
      delta-=stakeBase*3;
      return {...a,resultado:'RED',numeroResultado:r1,numeroGale:0,desfecho:'FALHA_GALE',bancaAplicada:true};
    }
    if(avaliar(a.entrada,r2)==='GREEN'){
      delta+=stakeBase;
      return {...a,resultado:'RED',numeroResultado:r1,numeroGale:r2,desfecho:'GREEN_GALE1',bancaAplicada:true};
    }
    delta-=stakeBase*3;
    return {...a,resultado:'RED',numeroResultado:r1,numeroGale:r2,desfecho:'FALHA_GALE',bancaAplicada:true};
  });
  return {alertas:novos,delta};
}

export function formatResultado(a:Alerta){
  if(a.numeroResultado==null) return 'aguardando…';
  if(a.numeroResultado===0) return '0 · ⏸ sem aposta';
  const first=`${a.numeroResultado} → ${a.resultado==='GREEN'?'✅ GREEN':'❌ RED'}`;
  if(a.resultado==='GREEN' || a.regime==='HOSTIL') return first;
  if(a.numeroGale==null) return `${first} · aguardando G1…`;
  const g=avaliar(a.entrada,a.numeroGale);
  return `${first} · ${a.numeroGale} → ${g==='GREEN'?'✅ GREEN/G1':'❌❌ RED/G1'}`;
}

export function resolverPendentes(alertas:Alerta[],cat:number[],stakeBase=0){
  return aplicarResultados(alertas,cat,stakeBase).alertas;
}
