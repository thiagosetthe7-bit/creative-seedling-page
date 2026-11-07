import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/roleta/AppShell";
import { TabelaCatalogacao } from "@/components/roleta/TabelaCatalogacao";
import { criarSpin } from "@/lib/roleta/catalogo";
import { baixarCSVCatalogacao } from "@/lib/exportCatalogacao";

export const Route = createFileRoute("/backtest")({
  head: () => ({ meta: [{ title: "Importação de Histórico — Roleta" }, { name: "description", content: "Importação e conferência de resultados históricos da roleta." }] }),
  component: ImportarHistorico,
});
function ImportarHistorico() {
  const [input, setInput] = useState("");
  const [spins, setSpins] = useState<ReturnType<typeof criarSpin>[] | null>(null);
  const [error, setError] = useState("");
  const processar = () => {
    const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length || lines.length % 2 !== 0) { setError("Informe pares de linhas: número e, em seguida, horário HH:MM."); setSpins(null); return; }
    const parsed: Array<{ number: number; minutes: number; sourceIndex: number; timestamp: number }> = [];
    for (let i = 0; i < lines.length; i += 2) {
      if (!/^\d{1,2}$/.test(lines[i] ?? "")) { setError(`Linha ${i+1}: número inválido.`); setSpins(null); return; }
      const number = Number(lines[i]);
      if (number < 0 || number > 36) { setError(`Linha ${i+1}: use um número de 0 a 36.`); setSpins(null); return; }
      const match = /^(?:([01]\d|2[0-3])):([0-5]\d)$/.exec(lines[i+1] ?? "");
      if (!match) { setError(`Linha ${i+2}: horário inválido. Use HH:MM.`); setSpins(null); return; }
      parsed.push({ number, minutes: Number(match[1])*60+Number(match[2]), sourceIndex: i/2, timestamp: 0 });
    }
    if (parsed.length > 100) { setError("O limite é de 100 pares por importação."); setSpins(null); return; }
    let dayOffset = 0; let previous: number | null = null;
    for (const item of parsed) { if (previous !== null && item.minutes > previous) dayOffset--; item.timestamp = (dayOffset*1440+item.minutes)*60000; previous = item.minutes; }
    const ordered = parsed.sort((a,b)=>a.timestamp-b.timestamp || a.sourceIndex-b.sourceIndex).map(item=>criarSpin(item.number,item.timestamp));
    setError(""); setSpins(ordered);
  };
  return <AppShell><div className="mx-auto max-w-5xl space-y-5">
    <header><p className="text-xs font-black tracking-[0.2em] text-amber-500">IMPORTAÇÃO DE DADOS</p><h1 className="mt-1 text-xl font-black tracking-widest">IMPORTAR HISTÓRICO DE GIROS</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Cole até 100 pares número + horário. O conteúdo é ordenado cronologicamente e apresentado como catalogação, sem análise ou disparo de estratégias.</p></header>
    <section className="space-y-3 rounded-xl border border-border bg-card p-4"><label htmlFor="history-numbers" className="block text-sm font-bold">Número e horário em linhas alternadas</label><textarea id="history-numbers" value={input} onChange={(e)=>setInput(e.target.value)} rows={6} placeholder={"12\n18:42\n7\n18:41\n0\n18:40"} className="w-full rounded-lg border border-border bg-background p-3 font-mono text-sm"/><div className="flex flex-wrap gap-3"><button type="button" onClick={processar} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-black text-black">PROCESSAR HISTÓRICO</button><button type="button" onClick={()=>{setInput("");setSpins(null);setError("");}} className="rounded-lg border border-border px-4 py-2 text-sm font-bold">LIMPAR</button></div>{error && <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm font-bold text-rose-500">{error}</p>}</section>
    {spins && <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-black tracking-widest">CATALOGAÇÃO IMPORTADA</h2><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{spins.length} giros</span><button type="button" onClick={()=>baixarCSVCatalogacao(spins,{})} className="rounded-lg border border-border px-3 py-2 text-xs font-black">EXPORTAR CSV</button></div></div><TabelaCatalogacao spins={spins}/></section>}
  </div></AppShell>;
}
