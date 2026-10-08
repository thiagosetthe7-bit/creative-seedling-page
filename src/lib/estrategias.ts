import { atributos } from './avaliador';
import { CONFIG } from './config';

export interface Sinal { estrategia:string; entrada:string; indiceSinal:number; alvo:number; padrao:string; }

export function detBrSeparado(rows:{numero:number;bip:string|null;tipo:string}[]):Sinal[]{
  const out:Sinal[]=[];
  rows.forEach((r,i)=>{
    if(r.bip!=='BR'||r.tipo!=='SEPARADO')return;
    if(i>0&&rows[i-1]!.bip)return;
    const alt=atributos(r.numero).alt;
    if(alt==='ZERO')return;
    out.push({estrategia:'BR SEPARADO',entrada:alt,indiceSinal:i,alvo:i+1,padrao:`BR isolado SEPARADO · altura ${alt} repete`});
  });
  return out;
}

export function detSeqGeom(rows:{numero:number}[]):Sinal[]{
  const out:Sinal[]=[];
  for(const chave of ['duzia','coluna'] as const){
    const val=(n:number)=>chave==='duzia'?(n===0?null:n<=12?'D1':n<=24?'D2':'D3'):(n===0?null:n%3===1?'C1':n%3===2?'C2':'C3');
    let run=1;
    for(let i=1;i<rows.length;i++){
      const v=val(rows[i]!.numero),p=val(rows[i-1]!.numero);
      if(v&&v===p)run++;else run=1;
      if(v&&run===5)out.push({estrategia:'SEQ GEOMÉTRICA 5x',entrada:v,indiceSinal:i,alvo:i+1,padrao:`${v}×5 consecutivas`});
    }
  }
  return out;
}

export function detBtQuebra(rows:{numero:number;bip:string|null}[]):Sinal[]{
  const out:Sinal[]=[];
  rows.forEach((r,i)=>{
    if(r.bip!=='BT'||i===0)return;
    const cor=atributos(r.numero).cor,corA=atributos(rows[i-1]!.numero).cor;
    if(cor==='ZERO'||cor===corA)return;
    let len=1;
    for(let j=i-2;j>=0;j--){if(atributos(rows[j]!.numero).cor===corA)len++;else break;}
    if(len<3)return;
    out.push({estrategia:'BT QUEBRA COR',entrada:cor,indiceSinal:i,alvo:i+1,padrao:`${corA}×${len} quebrada por ${cor} no BT · inversão`});
  });
  return out;
}

export function detOscRet(nums:number[]):Sinal[]{
  const out:Sinal[]=[];
  for(const dim of ['COR','PAR','ALT'] as const){
    const v=(n:number)=>{const a=atributos(n);return n===0?null:dim==='COR'?a.cor:dim==='PAR'?a.par:a.alt;};
    const seq:{idx:number;v:string}[]=[];
    nums.forEach((n,i)=>{const x=v(n);if(x)seq.push({idx:i,v:x});});
    const runs:{v:string;end:number;len:number}[]=[];
    for(const s of seq){const l=runs[runs.length-1];if(l&&l.v===s.v){l.end=s.idx;l.len++;}else runs.push({v:s.v,end:s.idx,len:1});}
    if(runs.length<2)continue;
    const b=runs[runs.length-1]!,a=runs[runs.length-2]!,ultimo=seq[seq.length-1]!.idx;
    if(b.end!==ultimo|| (b.len!==1&&b.len!==2)||a.len<CONFIG.MIN_A)continue;
    const zero=nums.slice(Math.max(0,ultimo-(CONFIG.JANELA_ZERO-1)),ultimo+1).includes(0);
    const j=nums.slice(Math.max(0,ultimo-11),ultimo+1).filter(x=>x!==0);
    const sat=j.length>0&&j.filter(x=>v(x)===b.v).length/j.length>=CONFIG.LIMIAR_SAT;
    if(zero||sat)continue;
    out.push({estrategia:b.len===2?'OSCILAÇÃO':'RETORNO',entrada:a.v,indiceSinal:ultimo,alvo:ultimo+1,padrao:`${a.v}×${a.len} → ${b.v}×${b.len} → entrar ${a.v}`});
  }
  return out;
}

export function calibrarEstrategias(nums:number[],rows:{numero:number;bip:string|null;tipo:string}[]=[]){
  return {
    brSeparado:detBrSeparado(rows),
    seqGeom:detSeqGeom(nums.map(numero=>({numero}))),
    btQuebra:detBtQuebra(rows),
    oscRet:detOscRet(nums),
  };
}
