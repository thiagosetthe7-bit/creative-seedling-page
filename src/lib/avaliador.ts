export type Dimensao = "COR" | "PARIDADE" | "ALTURA" | "COLUNA" | "DUZIA";
export interface EntradaMapeada { dimensao: Dimensao; valor: string; }

const VERMELHO = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const PRETO = new Set(Array.from({length:36},(_,i)=>i+1).filter(n=>!VERMELHO.has(n)));

export function atributos(n:number) {
  if(n===0) return {cor:"VERDE",alt:"ZERO",par:"ZERO",duzia:"ZERO",coluna:"ZERO"} as const;
  return {cor:VERMELHO.has(n)?"VERMELHO":"PRETO",alt:n>=19?"ALTO":"BAIXO",
    par:n%2===0?"PAR":"IMPAR",duzia:n<=12?"D1":n<=24?"D2":"D3",
    coluna:n%3===1?"C1":n%3===2?"C2":"C3"} as const;
}
export function normalizarEntrada(b:string):string {
  return (b||"").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/^\s*(ENTRAR EM|ENTRADA:|SINAL:|APUESTA:|BET:)\s+/g,"")
    .replace(/\s+/g," ").trim();
}
export function mapearEntrada(s:string):EntradaMapeada|null {
  switch(s){
    case "VERMELHO":case "PRETO":return{dimensao:"COR",valor:s};
    case "PAR":case "IMPAR":return{dimensao:"PARIDADE",valor:s};
    case "ALTO":case "BAIXO":return{dimensao:"ALTURA",valor:s};
    case "C1":case "C2":case "C3":return{dimensao:"COLUNA",valor:s};
    case "D1":case "D2":case "D3":return{dimensao:"DUZIA",valor:s};
    default:return null;
  }
}
export function pertence(m:EntradaMapeada,n:number):boolean {
  if(n===0)return false;
  const a=atributos(n);
  switch(m.dimensao){
    case "COR":return a.cor===m.valor;
    case "PARIDADE":return a.par===m.valor;
    case "ALTURA":return a.alt===m.valor;
    case "COLUNA":return a.coluna===m.valor;
    case "DUZIA":return a.duzia===m.valor;
  }
}
export function avaliarEntrada(bruta:string,n:number):"GREEN"|"RED"|null {
  if(n===0)return null;
  const m=mapearEntrada(normalizarEntrada(bruta));
  if(!m)return null;
  return pertence(m,n)?"GREEN":"RED";
}
export const SELF_TEST = [
  {e:"PRETO",n:32,esp:"RED"},{e:"PRETO",n:13,esp:"GREEN"},
  {e:"VERMELHO",n:13,esp:"RED"},{e:"ALTO",n:13,esp:"RED"},
  {e:"ALTO",n:0,esp:null},{e:"VERMELHO",n:12,esp:"GREEN"},
  {e:"PAR",n:4,esp:"GREEN"},{e:"IMPAR",n:33,esp:"GREEN"},
  {e:"ALTO",n:36,esp:"GREEN"},{e:"BAIXO",n:2,esp:"GREEN"},
] as const;
export function rodarSelfTest(){
  const falhas=SELF_TEST.filter(c=>avaliarEntrada(c.e,c.n)!==c.esp);
  return{ok:falhas.length===0,total:SELF_TEST.length, falhas};
}
