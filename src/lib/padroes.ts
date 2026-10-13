export type Dim = "COR" | "PAR" | "ALT";
import { atributos } from "./avaliador";
import { CONFIG } from "./config";
import type { Desfecho } from "./resolver";
export interface Trigger { id:string; tipo:"OSCILACAO"|"RETORNO"; dim:string; entrada:string; indiceSinal:number; alvo:number; nA:number; mB:number; padrao:string; }
const valDim=(dim:string,n:number):string|null=>{
  if(n===0)return null; const a=atributos(n);
  return dim==="COR"?a.cor:dim==="PAR"?a.par:a.alt;
};
export function detectarTriggers(nums:number[]):Trigger[]{
  const out:Trigger[]=[];
  for(const dim of ["COR","PAR","ALT"]){
    const seq:{idx:number;v:string}[]=[];
    nums.forEach((n,i)=>{const v=valDim(dim,n);if(v)seq.push({idx:i,v});});
    const runs:{v:string;end:number;len:number}[]=[];
    for(const s of seq){const l=runs[runs.length-1];if(l&&l.v===s.v){l.end=s.idx;l.len++;}else runs.push({v:s.v,end:s.idx,len:1});}
    if(runs.length<2)continue;
    const b=runs[runs.length-1]!,a=runs[runs.length-2]!,ultimo=seq[seq.length-1]!.idx;
    if(b.end!==ultimo||(b.len!==1&&b.len!==2)||a.len<CONFIG.MIN_A)continue;
    const zeroRecente=nums.slice(Math.max(0,ultimo-CONFIG.JANELA_ZERO+1),ultimo+1).includes(0);
    const janela=nums.slice(Math.max(0,ultimo-CONFIG.JANELA_SAT+1),ultimo+1).filter(n=>n!==0);
    const saturado=(["COR","PAR","ALT"] as const).some(d=>{
      const vals=janela.map(n=>valDim(d,n)).filter((x):x is string=>x!==null);
      return vals.length>0&&Math.max(0,...Array.from(new Set(vals),v=>vals.filter(x=>x===v).length))/vals.length>=CONFIG.LIMIAR_SAT;
    });
    if(zeroRecente||saturado)continue;
    out.push({id:`${dim}-${ultimo}-${b.len}`,tipo:b.len===2?"OSCILACAO":"RETORNO",dim,entrada:a.v,indiceSinal:ultimo,alvo:ultimo+1,nA:a.len,mB:b.len,padrao:`${a.v} × ${a.len} → ${b.v} × ${b.len} → entrar ${a.v}`});
  }
  return out;
}
export interface StatsPadrao {n:number;greens:number}
export function medirPadrao(desfechos:Desfecho[]):StatsPadrao{
  const r=desfechos.filter(d=>d!=null&&d!=="PAUSA");
  return{n:r.length,greens:r.filter(d=>d==="GREEN_DIRETO"||d==="GREEN_GALE1").length};
}
export function rotuloConfianca(s:StatsPadrao){
  if(s.n<CONFIG.N_VALIDAR)return `medindo... (${s.n})`;
  return `${Math.round(s.greens/s.n*100)}% em ${s.n} sinais (medido)`;
}
export function autoTestPadroes(){
  const errors:string[]=[];
  if(!detectarTriggers([19,21,2,4]).some(t=>t.tipo==="OSCILACAO"&&t.entrada==="VERMELHO"))errors.push("OSC");
  if(!detectarTriggers([19,21,2]).some(t=>t.tipo==="RETORNO"&&t.entrada==="VERMELHO"))errors.push("RET");
  if(detectarTriggers([19,21,2,0,4]).length!==0)errors.push("zero recente");
  if(detectarTriggers([19,21,2,4,6]).length!==0)errors.push("guarda B=3");
  return{ok:errors.length===0,errors};
}
