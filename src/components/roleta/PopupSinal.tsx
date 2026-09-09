import type { Sinal } from "@/lib/roleta/engine";
import { acoes } from "@/lib/roleta/store";
import { estiloCelula } from "@/lib/roleta/paleta";

function hora(ts: number) {
  return new Date(ts).toLocaleTimeString("pt-BR");
}

export function PopupSinal({ sinal }: { sinal: Sinal }) {
  const estilo = estiloCelula(sinal.categoria, sinal.alvo);
  const corBorda = estilo.bg;
  const corTexto = estilo.fg;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border-2 bg-card shadow-2xl"
        style={{ borderColor: corBorda }}
      >
        <div
          className="px-4 py-3 text-center"
          style={{ backgroundColor: corBorda, color: corTexto }}
        >
          <div className="text-lg font-black tracking-widest">🚨 ENTRADA DETECTADA</div>
        </div>
        <div className="space-y-3 p-4">
          <div className="text-center">
            <div className="text-xs font-bold tracking-widest text-muted-foreground">
              CATEGORIA
            </div>
            <div
              className="mx-auto mt-1 inline-block rounded px-3 py-1 text-xl font-black"
              style={{ backgroundColor: corBorda, color: corTexto }}
            >
              {sinal.categoriaLabel}
            </div>
          </div>
          <div
            className="rounded-lg border-2 py-3 text-center"
            style={{ borderColor: corBorda, backgroundColor: `${corBorda}1A` }}
          >
            <div className="text-xs font-bold tracking-widest text-muted-foreground">
              ENTRADA RECOMENDADA
            </div>
            <div
              className="text-3xl font-black"
              style={{ color: corBorda }}
            >
              {sinal.alvo}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Sequência anterior</dt>
            <dd className="text-right font-bold">
              {sinal.sequenciaInicial}x {sinal.alvo}
            </dd>
            <dt className="text-muted-foreground">Quebra</dt>
            <dd className="text-right font-bold">
              {sinal.quebra} ({sinal.quebraRodadas}x)
            </dd>
            <dt className="text-muted-foreground">Retorno</dt>
            <dd className="text-right font-bold">{sinal.retorno}</dd>
            <dt className="text-muted-foreground">Número da rodada</dt>
            <dd className="text-right font-bold">
              {sinal.rodada} (nº {sinal.numero})
            </dd>
            <dt className="text-muted-foreground">Horário</dt>
            <dd className="text-right font-bold">{hora(sinal.timestamp)}</dd>
          </dl>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => acoes.confirmar(sinal.id)}
              className="flex-1 rounded py-2 text-sm font-black"
              style={{ backgroundColor: corBorda, color: corTexto }}
            >
              CONFIRMAR SINAL
            </button>
            <button
              onClick={() => acoes.marcarVisto(sinal.id)}
              className="rounded border border-border px-4 py-2 text-sm font-bold hover:bg-accent"
            >
              FECHAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
