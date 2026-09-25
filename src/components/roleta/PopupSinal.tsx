import type { Sinal } from "@/lib/roleta/engine";
import { acoes } from "@/lib/roleta/store";
import { calculateSmartStake, type BancaState, registerBancaResult, registerBancaGale1 } from "./GerenciadorBanca";

export function PopupSinal({ sinal }: { sinal: Sinal }) {
  const isPause = sinal.type === "PAUSE";
  let stake = 0;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("roleta-gerenciador-banca-v2");
      if (raw) stake = calculateSmartStake(JSON.parse(raw) as BancaState, sinal);
    } catch { stake = 0; }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border-2 bg-card shadow-2xl" style={{ borderColor: sinal.colorCode }}>
        <section className="flex min-h-[260px] flex-col items-center justify-center px-6 py-8 text-center" style={{ backgroundColor: sinal.colorCode }}>
          <div className="text-xl font-black tracking-widest text-white">{sinal.title}</div>
          <div className="mt-5 text-4xl font-black text-white">{sinal.mainAction}</div>
        </section>
        <section className="min-h-[170px] space-y-3 p-5">
          {sinal.coverageText && <div className="text-base font-medium">✅ COBERTURA: {sinal.coverageText}</div>}
          {sinal.type === "PAUSE" && <div className="text-base font-black">⏸ SEM APOSTA</div>}
          {sinal.confidence >= 78 && sinal.type === "ENTRY_SIGNAL" && !sinal.observacaoHostil && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-lg font-black text-emerald-400">💰 STAKE SUGERIDA: {stake.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>}
          {sinal.type === "ENTRY_SIGNAL" && (
            <div className={sinal.gale1Liberado ? "rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-black text-emerald-400" : "rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-black text-amber-300"}>
              {sinal.observacaoHostil
                ? "👁 OBSERVAÇÃO · STAKE 0 · 🔒 GALE 1 BLOQUEADO"
                : sinal.gale1Liberado
                  ? "🔓 GALE 1 LIBERADO — janela limpa"
                  : `🔒 GALE 1 BLOQUEADO — regime hostil (motivo: ${sinal.motivoHostil})`}
            </div>
          )}
          {sinal.confidence < 78 && <div className="rounded bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">Padrão detectado, mas assertividade abaixo de 78%. Aguardando.</div>}
          
          {sinal.type === "ENTRY_SIGNAL" && !sinal.observacaoHostil && sinal.confidence >= 78 && (
            <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
              <button onClick={() => registerBancaResult(true)} className="rounded-lg bg-emerald-400 px-3 py-3 text-sm font-black text-black">G · GREEN</button>
              <button onClick={() => registerBancaGale1()} disabled={!sinal.gale1Liberado} className="rounded-lg bg-amber-400 px-3 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-30">G1 · GALE 1 GREEN</button>
            </div>
          )}
          {sinal.type !== "PAUSE" && <div className="border-t border-border pt-3 text-xs italic text-muted-foreground">{sinal.footerNote ?? `Conf: ${sinal.confidence}%`}</div>}
          {isPause && <div className="text-xs italic text-muted-foreground">Não entrar em nada</div>}
          <div className="flex gap-2 pt-1">
            {sinal.confidence >= 78 && sinal.type === "ENTRY_SIGNAL" && (<button onClick={() => acoes.confirmar(sinal.id)} className="flex-1 rounded py-2 text-sm font-black text-white" style={{ backgroundColor: sinal.colorCode }}>CONFIRMAR</button>)}
            <button onClick={() => acoes.marcarVisto(sinal.id)} className="rounded border border-border px-4 py-2 text-sm font-bold hover:bg-accent">FECHAR</button>
          </div>
        </section>
      </div>
    </div>
  );
}
