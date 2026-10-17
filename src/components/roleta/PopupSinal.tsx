import { mensagemPopup } from "@/lib/confianca";
import { acoes } from "@/lib/roleta/store";
import type { Sinal } from "@/lib/roleta/engine";
import type { StatsPadrao } from "@/lib/padroes";
import { CONFIG } from "@/lib/config";
import { useEstado } from "@/lib/roleta/store";
import { computarDesfecho, type AlertaBase } from "@/lib/resolver";
import { gateDoAlerta } from "@/lib/gate";
import type { Regime } from "@/lib/regime";

export function PopupSinal({
  sinal,
  stats,
}: {
  sinal: Sinal;
  stats: StatsPadrao;
}) {
  const isPause = sinal.type === "PAUSE";
  const estado = useEstado();
  const catalogo = estado.spins.map((spin) => spin.numero);
  const alerta: AlertaBase = {
    id: sinal.id,
    entrada: sinal.mainAction,
    estrategia: sinal.title,
    indiceSinal: Math.max(0, (sinal.rodada || 1) - 1),
    regime: sinal.regimeClassificado,
    observacao: sinal.observacaoHostil,
    padrao: sinal.footerNote || sinal.sequenceContext || sinal.title,
  };
  const desfecho = computarDesfecho(alerta, catalogo).desfecho;
  const janelaRecente = catalogo.slice(-8);
  const regimeGate: Regime = janelaRecente.includes(0)
    ? "PAUSA"
    : sinal.regimeClassificado === "HOSTIL" ? "HOSTIL" : "LIMPA";
  const gate = gateDoAlerta(alerta, catalogo, desfecho, regimeGate);

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
  const somenteObservacao = sinal.title.startsWith("SEQ GEOMÉTRICA") || sinal.title.startsWith("👁 OBSERVAÇÃO");
  const podeConfirmar = !isPause && gate.confirmavel && sinal.type === "ENTRY_SIGNAL" &&
    !somenteObservacao &&
    (regimeGate === "HOSTIL" || (sinal.gale1Liberado && !sinal.observacaoHostil)) &&
    (stats.n < CONFIG.N_VALIDAR || stats.greens / stats.n >= CONFIG.PISO_MODERADO);

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
              <div>PADRÃO: <strong>{sinal.footerNote || sinal.sequenceContext || sinal.message || sinal.title}</strong></div>
              <div>📊 CONFIANÇA: {L.confianca}</div>
              <div>{L.regime}</div>
              <div>{L.decisao}</div>
              <div>{L.gale}</div>
              {gate.aviso && <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold">{gate.aviso}</div>}
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
