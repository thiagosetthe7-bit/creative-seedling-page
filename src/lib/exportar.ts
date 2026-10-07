export interface SpinRow {
  indice: number;
  numero: number;
  bt: boolean;
  br: boolean;
  terminal: string;
  cavalo: string;
  alt: string;
  duzia: string;
  coluna: string;
  pi: string;
  tipo: string;
  secao: string;
  v010: string;
  v2234: string;
  cor: string;
}

export interface AlertaRow {
  id: string;
  estrategia: string;
  entrada: string;
  indiceSinal: number;
  regime: string;
  motivo: string;
  numeroResultado: number|null;
  numeroGale: number|null;
  desfecho: string;
}

function csvCell(value: unknown): string {
  const s = String(value ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function montarCSV(spins: SpinRow[], alertas: AlertaRow[]): string {
  const L: string[] = [];
  L.push('# SECAO 1 - CATALOGACAO (todos os giros registrados ate agora)');
  L.push('indice;numero;bt;br;terminal;cavalo;alt;duzia;coluna;pi;tipo;secao;v010;v2234;cor');
  for (const s of spins) {
    L.push([
      s.indice, s.numero, s.bt ? 'BT' : '', s.br ? 'BR' : '',
      s.terminal, s.cavalo, s.alt, s.duzia, s.coluna, s.pi,
      s.tipo, s.secao, s.v010, s.v2234, s.cor,
    ].map(csvCell).join(';'));
  }
  L.push('');
  L.push('# SECAO 2 - SINAIS (todos os alertas ate agora)');
  L.push('id;estrategia;entrada;indiceSinal;regime;motivo;numeroResultado;numeroGale;desfecho');
  for (const a of alertas) {
    L.push([
      a.id, a.estrategia, a.entrada, a.indiceSinal, a.regime, a.motivo,
      a.numeroResultado ?? '', a.numeroGale ?? '', a.desfecho ?? '',
    ].map(csvCell).join(';'));
  }
  return L.join('\n');
}

export function baixarCSV(spins: SpinRow[], alertas: AlertaRow[]): void {
  const blob = new Blob(['\ufeff' + montarCSV(spins, alertas)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
