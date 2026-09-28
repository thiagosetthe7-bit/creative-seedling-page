import { avaliarEntrada } from './avaliador';
import { normalizarEntrada } from './roleta/engine';

export type Desfecho='GREEN_DIRETO'|'GREEN_GALE1'|'FALHA_GIRO1'|'FALHA_GALE'|null;
export interface AlertaBase{ id:string; entrada:string; estrategia:string;
  indiceSinal:number; regime:'LIMPA'|'HOSTIL'; }

// FUNÇÃO PURA: resultado/desfecho derivados exclusivamente da catalogação.
export function computarDesfecho(a:AlertaBase, cat:number[]){
  const r1=cat[a.indiceSinal+1];
  if(r1==null) return {resultado:null,numeroResultado:null,numeroGale:null,desfecho:null as Desfecho};
  if(r1===0)   return {resultado:null,numeroResultado:0,numeroGale:null,desfecho:null as Desfecho};
  const m1=avaliarEntrada(normalizarEntrada(a.entrada),r1);
  if(m1==='GREEN') return {resultado:'GREEN' as const,numeroResultado:r1,numeroGale:null,desfecho:'GREEN_DIRETO' as Desfecho};
  if(a.regime==='HOSTIL') return {resultado:'RED' as const,numeroResultado:r1,numeroGale:null,desfecho:'FALHA_GIRO1' as Desfecho};
  const r2=cat[a.indiceSinal+2];
  if(r2==null) return {resultado:'RED' as const,numeroResultado:r1,numeroGale:null,desfecho:null as Desfecho};
  if(r2===0)   return {resultado:'RED' as const,numeroResultado:r1,numeroGale:0,desfecho:'FALHA_GALE' as Desfecho};
  const m2=avaliarEntrada(normalizarEntrada(a.entrada),r2);
  return m2==='GREEN'
    ? {resultado:'RED' as const,numeroResultado:r1,numeroGale:r2,desfecho:'GREEN_GALE1' as Desfecho}
    : {resultado:'RED' as const,numeroResultado:r1,numeroGale:r2,desfecho:'FALHA_GALE' as Desfecho};
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
