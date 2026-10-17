export interface SpinAnalise {
  indice:number; numero:number; bt:boolean; br:boolean; terminal?:string; cavalo?:string;
  alt?:string; duzia?:string; coluna?:string; pi?:string; tipo?:string; secao?:string;
  v010?:string; v2234?:string; cor?:string;
}
export interface SinalAnalise {
  id:string; estrategia:string; entrada:string; indiceSinal:number; regime:string; motivo?:string|null;
  numeroResultado?:number|null; numeroGale?:number|null; desfecho?:string|null; tier?:string|null;
  padrao?:string|null; estado?:string|null;
}
export interface RodapeIntegridade {
  falhas:number; pendentes:number; orfaos:number; selftest:"OK"|string;
}
function cell(value:unknown):string {
  const s=String(value??'');
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
}
export function montarCSVAnalise(catalogacao:SpinAnalise[], sinais:SinalAnalise[], integridade?:RodapeIntegridade):string {
  const linhas:string[]=[
    '# SECAO 1 - CATALOGACAO COMPLETA',
    'indice;numero;bt;br;terminal;cavalo;alt;duzia;coluna;pi;tipo;secao;v010;v2234;cor',
  ];
  for(const row of catalogacao) linhas.push([
    row.indice,row.numero,row.bt?'BT':'',row.br?'BR':'',row.terminal,row.cavalo,row.alt,
    row.duzia,row.coluna,row.pi,row.tipo,row.secao,row.v010,row.v2234,row.cor,
  ].map(cell).join(';'));
  linhas.push('','# SECAO 2 - SINAIS E DESFECHOS',
    'id;estrategia;entrada;indiceSinal;regime;motivo;numeroResultado;numeroGale;desfecho;tier;padrao;estado');
  for(const s of sinais) linhas.push([
    s.id,s.estrategia,s.entrada,s.indiceSinal,s.regime,s.motivo||'nenhum',
    s.numeroResultado??'',s.numeroGale??'',s.desfecho??'',s.tier??'',s.padrao??'',s.estado??'',
  ].map(cell).join(';'));
  if(integridade) linhas.push('',
    `# RODAPE - INTEGRIDADE: falhas=${integridade.falhas} · pendentes=${integridade.pendentes} · orfaos=${integridade.orfaos} · selftest=${integridade.selftest}`);
  return linhas.join('\r\n');
}
export function exportarParaAnalise(catalogacao:SpinAnalise[], sinais:SinalAnalise[], integridade?:RodapeIntegridade):void {
  const blob=new Blob(['\ufeff',montarCSVAnalise(catalogacao,sinais,integridade)],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  const now=new Date();
  const pad=(n:number)=>String(n).padStart(2,'0');
  const timestamp=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  link.href=url; link.download=`auditoria-${timestamp}.csv`; link.style.visibility='hidden';
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
