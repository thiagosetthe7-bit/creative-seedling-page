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

const val = (dim: Dim, n: number): string | null => {
  if (n === 0) return null;
  if (dim === 'COR') {
    return ([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(n))
      ? 'VERMELHO'
      : 'PRETO';
  }
  if (dim === 'PAR') return n % 2 === 0 ? 'PAR' : 'IMPAR';
  return n >= 19 ? 'ALTO' : 'BAIXO';
};

// Detecta Aⁿ-B-A: após corrida de B com m==1 (RETORNO) ou m==2 (OSCILAÇÃO),
// prevê que o próximo giro retorna ao valor A da corrida anterior.
export function detectarTriggers(nums: number[]): Trigger[] {
  const out: Trigger[] = [];

  for (const dim of ['COR', 'PAR', 'ALT'] as Dim[]) {
    const seq: { idx: number; v: string }[] = [];
    nums.forEach((n, i) => {
      const v = val(dim, n);
      if (v) seq.push({ idx: i, v });
    });

    // Run-length encode.
    const runs: { v: string; start: number; end: number; len: number }[] = [];
    for (const s of seq) {
      const last = runs[runs.length - 1];
      if (last && last.v === s.v) {
        last.end = s.idx;
        last.len++;
      } else {
        runs.push({ v: s.v, start: s.idx, end: s.idx, len: 1 });
      }
    }

    if (runs.length < 2) continue;

    const b = runs[runs.length - 1]!;
    const a = runs[runs.length - 2]!;
    const ultimo = seq[seq.length - 1]!.idx;

    if (b.end !== ultimo) continue;
    if (b.len !== 1 && b.len !== 2) continue;

    // Filtros de regime no momento do disparo.
    const janela = nums.slice(Math.max(0, ultimo - 11), ultimo + 1);
    const zeroRecente = nums.slice(Math.max(0, ultimo - 7), ultimo + 1).includes(0);
    const semZero = janela.filter(x => x !== 0);
    const contagem = semZero.filter(x => val(dim, x) === b.v).length;
    const saturado = semZero.length > 0 && contagem / semZero.length >= 0.70;

    if (zeroRecente || saturado) continue;

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
