import { mensagemPopup } from "@/lib/confianca";
import { acoes } from "@/lib/roleta/store";
import type { Sinal } from "@/lib/roleta/engine";
import type { StatsPadrao } from "@/lib/padroes";

export function PopupSinal({
  sinal,
  stats,
}: {
  sinal: Sinal;
  stats: StatsPadrao;
}) {
  const isPause = sinal.type === "PAUSE";

  const fechar = () => acoes.marcarVisto(sinal.id);
  const confirmar = () => acoes.confirmar(sinal.id);

  const m = mensagemPopup({
    estrategia: sinal.title.replace(/^👁\s*OBSERVAÇÃO\s*·\s*/i, ""),
    stats,
    regime: sinal.regimeClassificado ?? (sinal.observacaoHostil ? "HOSTIL" : "LIMPA"),
    motivoHostil: sinal.motivoHostil,
    rebaixadoPorRegime: Boolean(sinal.observacaoHostil),
    galeLiberado: Boolean(sinal.gale1Liberado),
  });
  const L = m.linhas;
  const podeConfirmar = !isPause && sinal.type === "ENTRY_SIGNAL" &&
    sinal.gale1Liberado && !sinal.observacaoHostil && stats.n >= 20;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <section className="px-6 py-6 text-center" style={{ backgroundColor: sinal.colorCode }}>
          <div className="text-sm font-black tracking-widest text-white">{L.gatilho}</div>
          <div className="mt-3 text-3xl font-black text-white">{sinal.mainAction}</div>
        </section>

        <section className="space-y-3 p-5">
          {isPause ? (
            <div className="rounded-lg bg-muted p-3 text-center text-base font-black">⏸ SEM APOSTA</div>
          ) : (
            <div className="popup-linhas space-y-2 text-sm">
              <div>🎯 GATILHO: <strong>{L.gatilho}</strong></div>
              <div>📊 CONFIANÇA: {L.confianca}</div>
              <div>{L.regime}</div>
              <div>{L.decisao}</div>
              <div>{L.gale}</div>
            </div>
          )}

          <div className="flex gap-2 border-t border-border pt-3">
            {podeConfirmar && (
              <button type="button" onClick={confirmar} className="btn-green flex-1 rounded bg-primary py-2 text-sm font-black text-primary-foreground">
                CONFIRMAR
              </button>
            )}
            <button type="button" onClick={fechar} className="btn-neutro flex-1 rounded border border-border px-4 py-2 text-sm font-bold hover:bg-accent">
              FECHAR
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
