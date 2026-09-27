import { acoes } from "@/lib/roleta/store";
import { calculateSmartStake, type BancaState, registerBancaResult, registerBancaGale1 } from "./GerenciadorBanca";
import type { Sinal } from "@/lib/roleta/engine";

export function PopupSinal({ sinal }: { sinal: Sinal }) {
  const isPause = sinal.type === "PAUSE";
  let stake = 0;

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("roleta-gerenciador-banca-v2");
      if (raw) stake = calculateSmartStake(JSON.parse(raw) as BancaState, sinal);
    } catch {
      stake = 0;
    }
  }

  const fechar = () => acoes.marcarVisto(sinal.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <section className="px-6 py-6 text-center" style={{ backgroundColor: sinal.colorCode }}>
          <div className="text-sm font-black tracking-widest text-white">{sinal.title}</div>
          <div className="mt-3 text-3xl font-black text-white">{sinal.mainAction}</div>
        </section>

        <section className="space-y-3 p-5">
          {sinal.type === "PAUSE" ? (
            <div className="rounded-lg bg-muted p-3 text-center text-base font-black">⏸ SEM APOSTA</div>
          ) : sinal.observacaoHostil ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-center text-sm font-black text-amber-300">
              MODO OBSERVAÇÃO · STAKE 0
            </div>
          ) : (
            <>
              {sinal.confidence >= 78 && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-base font-black text-emerald-400">
                  STAKE SUGERIDA: {stake.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
              )}
              <div className={sinal.gale1Liberado
                ? "rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-sm font-black text-emerald-400"
                : "rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-center text-sm font-black text-amber-300"}>
                {sinal.gale1Liberado ? "GALE 1 LIBERADO" : "GALE 1 BLOQUEADO"}
              </div>
              {sinal.confidence >= 78 && (
                <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
                  <button type="button" onClick={() => registerBancaResult(true)} className="rounded-lg bg-emerald-400 px-3 py-3 text-sm font-black text-black">G · GREEN</button>
                  <button type="button" onClick={() => registerBancaGale1()} disabled={!sinal.gale1Liberado} className="rounded-lg bg-amber-400 px-3 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-30">G1 · GALE 1</button>
                </div>
              )}
            </>
          )}

          <div className="flex gap-2 border-t border-border pt-3">
            {sinal.confidence >= 78 && sinal.type === "ENTRY_SIGNAL" && !sinal.observacaoHostil && !isPause && (
              <button type="button" onClick={() => acoes.confirmar(sinal.id)} className="flex-1 rounded bg-primary py-2 text-sm font-black text-primary-foreground">CONFIRMAR</button>
            )}
            <button type="button" onClick={fechar} className="flex-1 rounded border border-border px-4 py-2 text-sm font-bold hover:bg-accent">FECHAR</button>
          </div>
        </section>
      </div>
    </div>
  );
}
