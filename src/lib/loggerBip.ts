export type Dim = 'COR'|'PAR'|'ALT'|'COL'|'DUZ'|'SEC'|'V0'|'V34';

export interface RowBip {
  n: number;
  bip: 'BT'|'BR'|null;
}

export interface EventoBip {
  bip: 'BT'|'BR';
  dim: Dim;
  runAnterior: number;
  repetiu: boolean;
  lag: number|null;
  outrasAreasLongas: number;
}

export const LIMIAR_RUN = 5;

const VER = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const VOI = new Set([22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25]);
const TIE = new Set([27,13,36,11,30,8,23,10,5,24,16,33]);
const ORF = new Set([17,34,6,1,20,14,31,9]);

export function rotulo(dim: Dim, n: number): string|null {
  if (n === 0 && dim !== 'SEC') return null;
  switch (dim) {
    case 'COR': return VER.has(n) ? 'V' : 'P';
    case 'PAR': return n % 2 === 0 ? 'PAR' : 'IMPAR';
    case 'ALT': return n >= 19 ? 'ALTO' : 'BAIXO';
    case 'COL': return n % 3 === 1 ? 'C1' : n % 3 === 2 ? 'C2' : 'C3';
    case 'DUZ': return n <= 12 ? 'D1' : n <= 24 ? 'D2' : 'D3';
    case 'SEC': return n === 0 ? 'ZERO' : VOI.has(n) ? 'VOI' : TIE.has(n) ? 'TIER' : ORF.has(n) ? 'ORF' : null;
    case 'V0': return [0,32,15,19,4,21,2,25,26,7,28,12,35,3].includes(n) ? '9V0' : '9V10';
    case 'V34': return [27,13,36,11,30,8,23,10,5,24,16,33,6,34,17,1,20,14,31,9].includes(n) ? '9V34' : '9V22';
  }
}

const DIMS: Dim[] = ['COR','PAR','ALT','COL','DUZ','SEC','V0','V34'];

function runAnterior(rows: RowBip[], i: number, dim: Dim) {
  const v = rotulo(dim, rows[i]!.n);
  let len = 0;
  let val: string|null = null;
  for (let j = i - 1; j >= 0; j--) {
    const r = rotulo(dim, rows[j]!.n);
    if (r == null) break;
    if (val == null) {
      val = r;
      len = 1;
    } else if (r === val) {
      len++;
    } else {
      break;
    }
  }
  return { v, val, len };
}

export function analisarBips(rows: RowBip[]): EventoBip[] {
  const ev: EventoBip[] = [];
  rows.forEach((row, i) => {
    if (!row.bip) return;
    const longas: { dim: Dim; len: number }[] = [];
    const info: Partial<Record<Dim, ReturnType<typeof runAnterior>>> = {};
    for (const dim of DIMS) {
      const r = runAnterior(rows, i, dim);
      info[dim] = r;
      if (r.len >= LIMIAR_RUN) longas.push({ dim, len: r.len });
    }
    for (const L of longas) {
      const r = info[L.dim]!;
      const repetiu = r.v === r.val;
      let lag: number|null = null;
      if (repetiu) {
        for (let k = i + 1; k < rows.length; k++) {
          const rv = rotulo(L.dim, rows[k]!.n);
          if (rv == null) { lag = null; break; }
          if (rv !== r.val) { lag = k - i; break; }
        }
      } else {
        lag = 0;
      }
      ev.push({
        bip: row.bip,
        dim: L.dim,
        runAnterior: L.len,
        repetiu,
        lag,
        outrasAreasLongas: longas.length - 1,
      });
    }
  });
  return ev;
}

export interface Bloco {
  repetiu: number;
  quebrou: number;
  lags: number[];
}

export interface Resumo {
  umaArea: Bloco;
  multiArea: Bloco;
}

export function agregar(ev: EventoBip[]): Record<'BT'|'BR', Resumo> {
  const b = (): Bloco => ({ repetiu: 0, quebrou: 0, lags: [] });
  const out: Record<'BT'|'BR', Resumo> = {
    BT: { umaArea: b(), multiArea: b() },
    BR: { umaArea: b(), multiArea: b() },
  };
  for (const e of ev) {
    const alvo = e.outrasAreasLongas >= 1 ? out[e.bip].multiArea : out[e.bip].umaArea;
    if (e.repetiu) {
      alvo.repetiu++;
      if (e.lag != null && e.lag > 0) alvo.lags.push(e.lag);
    } else {
      alvo.quebrou++;
    }
  }
  return out;
}

export function textoResumo(r: Record<'BT'|'BR', Resumo>) {
  const f = (x: Bloco) =>
    `repetiu ${x.repetiu} · quebrou ${x.quebrou}` +
    (x.lags.length ? ` · lag méd ${(x.lags.reduce((a,b) => a+b, 0) / x.lags.length).toFixed(1)}` : '');
  return {
    BR: `BR 1-área: ${f(r.BR.umaArea)} | BR 2+-áreas: ${f(r.BR.multiArea)}`,
    BT: `BT 1-área: ${f(r.BT.umaArea)} | BT 2+-áreas: ${f(r.BT.multiArea)}`,
  };
}

export function gerarLogBipCSV(ev: EventoBip[]): string {
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [
    ['BIP','DIM','RUN_ANTERIOR','REPETIU','LAG','OUTRAS_AREAS_LONGAS'],
    ...ev.map(e => [e.bip, e.dim, e.runAnterior, e.repetiu ? 'SIM' : 'NAO', e.lag ?? '', e.outrasAreasLongas]),
  ];
  return rows.map(row => row.map(esc).join(',')).join('\\n');
}
