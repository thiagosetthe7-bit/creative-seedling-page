export type Dim = 'COR' | 'PAR' | 'ALT';

import { atributos } from './avaliador';
import { CONFIG } from './config';

export interface Trigger {
  id:string; tipo:'OSCILACAO'|'RETORNO'; dim:string; entrada:string;
  indiceSinal:number; alvo:number; nA:number; mB:number; padrao:string;
}
const valDim=(dim:string,n:number):string|null=>{
  if(n===0)return null;
  const a=atributos(n);
  return dim==='COR'?a.cor:dim==='PAR'?a.par:a.alt;
};
export function detectarTriggers(nums:number[]):Trigger[]{
  const out:Trigger[]=[];
  for(const dim of ['COR','PAR','ALT']){
    const seq:{idx:number;v:string}[]=[];
    nums.forEach((n,i)=>{const v=valDim(dim,n);if(v)seq.push({idx:i,v});});
    const runs:{v:string;end:number;len:number}[]=[];
    for(const s of seq){const l=runs[runs.length-1];if(l&&l.v===s.v){l.end=s.idx;l.len++;}else runs.push({v:s.v,end:s.idx,len:1});}
    if(runs.length<2)continue;
    const b=runs[runs.length-1]!,a=runs[runs.length-2]!,ultimo=seq[seq.length-1]!.idx;
    if(b.end!==ultimo|| (b.len!==1&&b.len!==2) || a.len<CONFIG.MIN_A)continue;
    const zeroRecente=nums.slice(Math.max(0,ultimo-(CONFIG.JANELA_ZERO-1)),ultimo+1).includes(0);
    const j=nums.slice(Math.max(0,ultimo-11),ultimo+1).filter(x=>x!==0);
    const sat=j.length>0&&j.filter(x=>valDim(dim,x)===b.v).length/j.length>=CONFIG.LIMIAR_SAT;
    if(zeroRecente||sat)continue;
    out.push({id:`${dim}-${ultimo}-${b.len}`,tipo:b.len===2?'OSCILACAO':'RETORNO',dim,entrada:a.v,indiceSinal:ultimo,alvo:ultimo+1,nA:a.len,mB:b.len,padrao:`${a.v}×${a.len} → ${b.v}×${b.len} → entrar ${a.v}`});
  }
  return out;
}

export interface StatsPadrao { n:number; greens:number }
export function medirPadrao(desfechos: import('./resolver').Desfecho[]):StatsPadrao{
  const r=desfechos.filter(d=>d!=null);
  return {n:r.length,greens:r.filter(d=>d==='GREEN_DIRETO'||d==='GREEN_GALE1').length};
}
export function rotuloConfianca(s:StatsPadrao){return s.n<20?`medindo… (${s.n} sinais)`:`${Math.round(s.greens/s.n*100)}% em ${s.n} sinais (medido ao vivo)`;}
export function autoTestPadroes(){const errors:string[]=[];
if(detectarTriggers([19,21,2,4]).filter(t=>t.dim==='COR').some(t=>t.tipo==='OSCILACAO'&&t.entrada==='VERMELHO')===false)errors.push('T2/T3 OSC não detectada');
if(detectarTriggers([2,4,5]).filter(t=>t.dim==='PAR').some(t=>t.tipo==='RETORNO'&&t.entrada==='PAR')===false)errors.push('T2 RET não detectado');
if(detectarTriggers([19,21,2,0,4]).length!==0)errors.push('zero recente não bloqueou');
return {ok:errors.length===0,errors};}
