export type Dim = 'COR' | 'PAR' | 'ALT';

export interface Trigger {
  id: string;
  tipo: 'OSCILACAO' | 'RETORNO';
  dim: Dim;
  entrada: string;
  indiceSinal: number;
  alvo: number;
  nA: number;
  mB: number;
}

const VERM = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

const val = (dim: string, n: number): string|null => {
  if (n === 0) return null;
  if (dim === 'COR') return VERM.has(n) ? 'V' : 'P';
  if (dim === 'PAR') return n % 2 === 0 ? 'PAR' : 'IMPAR';
  return n >= 19 ? 'ALTO' : 'BAIXO';
};

export const JANELA_ZERO = 8;
export const MIN_A = 2;
export const LIMIAR_SAT = 0.70;

export function detectarTriggers(nums: number[], log?: string[]): Trigger[] {
  const out: Trigger[] = [];
  for (const dim of ['COR','PAR','ALT'] as Dim[]) {
    const seq: {idx:number;v:string}[] = [];
    nums.forEach((n,i) => {
      const v = val(dim,n);
      if (v) seq.push({idx:i,v});
    });

    const runs: {v:string;end:number;len:number}[] = [];
    for (const s of seq) {
      const l = runs[runs.length - 1];
      if (l && l.v === s.v) {
        l.end = s.idx;
        l.len++;
      } else {
        runs.push({v:s.v,end:s.idx,len:1});
      }
    }

    if (runs.length < 2) continue;
    const b = runs[runs.length - 1]!;
    const a = runs[runs.length - 2]!;
    const ultimo = seq[seq.length - 1]!.idx;

    if (b.end !== ultimo) continue;
    if (b.len !== 1 && b.len !== 2) continue;
    if (a.len < MIN_A) continue;

    // A janela é contada em índices reais da catalogação: os últimos 8 giros,
    // incluindo o giro atual. Zero em qualquer deles bloqueia o disparo.
    const zeroRecente = nums
      .slice(Math.max(0, ultimo - (JANELA_ZERO - 1)), ultimo + 1)
      .includes(0);

    const j = nums.slice(Math.max(0, ultimo - 11), ultimo + 1).filter(x => x !== 0);
    const sat = j.length > 0 &&
      j.filter(x => val(dim, x) === b.v).length / j.length >= LIMIAR_SAT;

    const motivo = zeroRecente ? 'BLOQ zero' : sat ? 'BLOQ sat' : 'DISPARA';
    log?.push(`${dim} ${a.v}(${a.len})→${b.v}(${b.len}) #${ultimo + 1}: ${motivo}`);

    if (zeroRecente || sat) continue;

    out.push({
      id: `${dim}-${ultimo}-${b.len}`,
      tipo: b.len === 2 ? 'OSCILACAO' : 'RETORNO',
      dim,
      entrada: a.v,
      indiceSinal: ultimo,
      alvo: ultimo + 1,
      nA: a.len,
      mB: b.len,
    });
  }
  return out;
}

import type { Desfecho } from './resolver';
export interface StatsPadrao { n: number; greens: number }
export function medirPadrao(desfechos: Desfecho[]): StatsPadrao {
  const resolvidos = desfechos.filter(d => d != null);
  return { n: resolvidos.length, greens: resolvidos.filter(d => d === 'GREEN_DIRETO' || d === 'GREEN_GALE1').length };
}
export function rotuloConfianca(s: StatsPadrao): string {
  if (s.n < 20) return `medindo… (${s.n} sinais)`;
  const pct = Math.round((s.greens / s.n) * 100);
  return `${pct}% em ${s.n} sinais (medido ao vivo)`;
}

export interface PadroesBoot { ok: boolean; errors: string[] }

export function autoTestPadroes(): PadroesBoot {
  const errors: string[] = [];
  const osc = detectarTriggers([1,3,2,4]).filter(t => t.dim === 'COR');
  if (!osc.some(t => t.tipo === 'OSCILACAO' && t.entrada === 'VERMELHO' && t.mB === 2)) {
    errors.push('T-v10 OSCILAÇÃO V,V,P,P não detectada');
  }
  const ret = detectarTriggers([2,4,5]).filter(t => t.dim === 'PAR');
  if (!ret.some(t => t.tipo === 'RETORNO' && t.entrada === 'PAR' && t.mB === 1)) {
    errors.push('T-v10 RETORNO PAR,PAR,IMPAR não detectado');
  }
  if (detectarTriggers([1,0,3,2,4]).length !== 0) {
    errors.push('T-v10 zero recente não bloqueou');
  }
  if (detectarTriggers([1,3,5,7,9,11,13,15,17,19,21,23]).length !== 0) {
    errors.push('T-v10 saturação não bloqueou');
  }
  return { ok: errors.length === 0, errors };
}
