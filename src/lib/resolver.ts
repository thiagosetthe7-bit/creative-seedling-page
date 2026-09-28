import { avaliarEntrada } from './avaliador';

export type Desfecho='GREEN_DIRETO'|'GREEN_GALE1'|'FALHA_GIRO1'|'FALHA_GALE'|null;
export interface AlertaBase{ id:string; entrada:string; estrategia:string;
  indiceSinal:number; regime:'LIMPA'|'HOSTIL'; }

// FUNÇÃO PURA: resultado/desfecho derivados da catalogação (nunca armazenados).
export function computarDesfecho(a:AlertaBase, cat:number[]){
  const r1=cat[a.indiceSinal+1];
  if(r1==null) return {resultado:null,numeroResultado:null,numeroGale:null,desfecho:null as Desfecho};
  if(r1===0)   return {resultado:null,numeroResultado:0,numeroGale:null,desfecho:null as Desfecho};
  const m1=avaliarEntrada(a.entrada,r1);
  if(m1==='GREEN') return {resultado:'GREEN' as const,numeroResultado:r1,numeroGale:null,desfecho:'GREEN_DIRETO' as Desfecho};
  if(a.regime==='HOSTIL') return {resultado:'RED' as const,numeroResultado:r1,numeroGale:null,desfecho:'FALHA_GIRO1' as Desfecho};
  const r2=cat[a.indiceSinal+2];
  if(r2==null) return {resultado:'RED' as const,numeroResultado:r1,numeroGale:null,desfecho:null as Desfecho};
  if(r2===0)   return {resultado:'RED' as const,numeroResultado:r1,numeroGale:0,desfecho:'FALHA_GALE' as Desfecho};
  const m2=avaliarEntrada(a.entrada,r2);
  return m2==='GREEN'
    ? {resultado:'RED' as const,numeroResultado:r1,numeroGale:r2,desfecho:'GREEN_GALE1' as Desfecho}
    : {resultado:'RED' as const,numeroResultado:r1,numeroGale:r2,desfecho:'FALHA_GALE' as Desfecho};
}

// BANCA DERIVADA (composta, sequencial, idempotente): recalcula a cada mudança da catalogação.
export function simularSequencias(bancaInicial:number, pct:number, alertas:AlertaBase[], cat:number[]){
  let banca=bancaInicial; const linhas=[];
  for(const a of [...alertas].sort((x,y)=>x.indiceSinal-y.indiceSinal)){
    const stake=Math.max(0.5, Math.round(banca*pct*2)/2);
    const d=computarDesfecho(a,cat).desfecho;
    let delta=0;
    if(d==='GREEN_DIRETO'||d==='GREEN_GALE1') delta=+stake;
    else if(d==='FALHA_GIRO1') delta=-stake;
    else if(d==='FALHA_GALE') delta=-3*stake;
    banca+=delta; linhas.push({id:a.id,desfecho:d,stake,delta,banca});
  }
  return {banca,linhas};
}
export function formatResultado(a:AlertaBase, cat:number[]){
  const r=computarDesfecho(a,cat);
  if(r.numeroResultado==null) return 'aguardando…';
  if(r.numeroResultado===0) return '0 · ⏸ sem aposta';
  const first=`${r.numeroResultado} → ${r.resultado==='GREEN'?'✅ GREEN':'❌ RED'}`;
  if(r.resultado==='GREEN'||a.regime==='HOSTIL') return first;
  if(r.numeroGale==null) return `${first} · aguardando G1…`;
  return `${first} · ${r.numeroGale} → ${r.desfecho==='GREEN_GALE1'?'✅ GREEN/G1':'❌❌ RED/G1'}`;
}

// Compatibilidade: alerta com resultado derivado + aplicação idempotente.
export interface Alerta extends AlertaBase {
  resultado: "GREEN"|"RED"|null; numeroResultado: number|null;
  numeroGale: number|null; desfecho: Desfecho; bancaAplicada: boolean;
}
export function aplicarResultados(alertas:Alerta[], cat:number[], unidade:number){
  let delta=0;
  const out=alertas.map((a):Alerta=>{
    const r=computarDesfecho(a,cat);
    const novo:Alerta={...a,resultado:r.resultado as Alerta["resultado"],numeroResultado:r.numeroResultado,numeroGale:r.numeroGale,desfecho:r.desfecho};
    const final=r.desfecho==='GREEN_DIRETO'||r.desfecho==='GREEN_GALE1'||r.desfecho==='FALHA_GIRO1'||r.desfecho==='FALHA_GALE';
    if(final&&!a.bancaAplicada){
      const u=unidade||0;
      if(r.desfecho==='GREEN_DIRETO'||r.desfecho==='GREEN_GALE1') delta+=u;
      else if(r.desfecho==='FALHA_GIRO1') delta-=u; else delta-=3*u;
      novo.bancaAplicada=true;
    }
    return novo;
  });
  return {alertas:out,delta};
}
