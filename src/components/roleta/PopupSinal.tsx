import type { Sinal } from "@/lib/roleta/engine";
import { acoes } from "@/lib/roleta/store";

const PRIORIDADE: Record<Sinal["priority"], string> = {
  CRITICAL: "CRÍTICA",
  HIGH: "ALTA",
  MEDIUM: "MÉDIA",
  LOW: "BAIXA",
};

function hora(ts: number) {
  return new Date(ts).toLocaleTimeString("pt-BR");
}

export function PopupSinal({ sinal }: { sinal: Sinal }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border-2 bg-card shadow-2xl"
        style={{ borderColor: sinal.colorCode }}
      >
        <div
          className="px-4 py-3 text-center"
          style={{ backgroundColor: sinal.colorCode, color: "#FFFFFF" }}
        >
          <div className="text-lg font-black tracking-wide">{sinal.title}</div>
          <div className="mt-1 text-[10px] font-black tracking-widest opacity-90">
            {sinal.type} · PRIORIDADE {PRIORIDADE[sinal.priority]}
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div
            className="rounded-lg border p-4 text-center"
            style={{ borderColor: sinal.colorCode, backgroundColor: `${sinal.colorCode}14` }}
          >
            <div className="text-xs font-bold tracking-widest text-muted-foreground">
              INSTRUÇÃO OPERACIONAL
            </div>
            <div className="mt-1 text-base font-black">{sinal.message}</div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 text-sm">
            <span className="text-muted-foreground">Rodada anterior</span>
            <strong className="text-right">
              {sinal.rodadaAnterior ?? "—"} · nº {sinal.numeroAnterior ?? "—"}
            </strong>
            <span className="text-muted-foreground">BIP atual</span>
            <strong className="text-right">
              {sinal.bip === "timer" ? "BT" : "BR"} · rodada {sinal.rodada} · nº {sinal.numero}
            </strong>
            <span className="text-muted-foreground">Confiança operacional</span>
            <strong className="text-right">{sinal.confidence}%</strong>
            <span className="text-muted-foreground">Horário</span>
            <strong className="text-right">{hora(sinal.timestamp)}</strong>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => acoes.confirmar(sinal.id)}
              className="flex-1 rounded py-2 text-sm font-black text-white"
              style={{ backgroundColor: sinal.colorCode }}
            >
              CONFIRMAR
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
