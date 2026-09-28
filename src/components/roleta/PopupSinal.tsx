import { acoes } from "@/lib/roleta/store";
import { linhaEntrada, rotuloAlerta } from "@/lib/labels";
import { calculateSmartStake, type BancaState } from "./GerenciadorBanca";
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
  const confirmar = () => acoes.confirmar(sinal.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <section className="px-6 py-6 text-center" style={{ backgroundColor: sinal.colorCode }}>
          <div className="text-sm font-black tracking-widest text-white">{rotuloAlerta({ estrategia: sinal.title.replace(/^👁\s*OBSERVAÇÃO\s*·\s*/i, "") })}</div>
          <div className="mt-3 text-3xl font-black text-white">{linhaEntrada({ entrada: sinal.mainAction })}</div>
        </section>

        <section className="space-y-3 p-5">
          {isPause ? (
            <div className="rounded-lg bg-muted p-3 text-center text-base font-black">⏸ SEM APOSTA</div>
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
                {sinal.gale1Liberado ? "GALE 1 LIBERADO" : "GALE 1 BLOQUEADO · HOSTIL"}
              </div>
            </>
          )}

          <div className="flex gap-2 border-t border-border pt-3">
            {!isPause && sinal.type === "ENTRY_SIGNAL" && sinal.confidence >= 78 && (
              <button type="button" onClick={confirmar} className="flex-1 rounded bg-primary py-2 text-sm font-black text-primary-foreground">
                CONFIRMAR
              </button>
            )}
            <button type="button" onClick={fechar} className="flex-1 rounded border border-border px-4 py-2 text-sm font-bold hover:bg-accent">
              FECHAR
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
