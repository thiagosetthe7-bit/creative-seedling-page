import { rotulo, type Dim } from './loggerBip';

const DIMS: Dim[] = ['COR','PAR','ALT','COL','DUZ','SEC','V0','V34'];

export interface TriggerRL {
  id: string;
  dim: Dim;
  entrada: string;
  indiceSinal: number;
  alvo: number;
  lenA: number;
  lenB: number;
}

// A(>=5) -> B(1-2) -> retorno A: no giro do retorno, identifica A como continuação.
export function detectarRetornoLongo(nums: number[]): TriggerRL[] {
  const out: TriggerRL[] = [];
  for (const dim of DIMS) {
    const seq: { idx: number; v: string }[] = [];
    nums.forEach((n, i) => {
      const v = rotulo(dim, n);
      if (v) seq.push({ idx: i, v });
    });

    const runs: { v: string; start: number; len: number }[] = [];
    for (const s of seq) {
      const l = runs[runs.length - 1];
      if (l && l.v === s.v) l.len++;
      else runs.push({ v: s.v, start: s.idx, len: 1 });
    }

    for (let k = 2; k < runs.length; k++) {
      const A = runs[k - 2];
      const B = runs[k - 1];
      const A2 = runs[k];
      if (A.len >= 5 && B.len >= 1 && B.len <= 2 && A2.v === A.v) {
        out.push({
          id: `RL-${dim}-${A2.start}`,
          dim,
          entrada: A.v,
          indiceSinal: A2.start,
          alvo: A2.start + 1,
          lenA: A.len,
          lenB: B.len,
        });
      }
    }
  }
  return out;
}
