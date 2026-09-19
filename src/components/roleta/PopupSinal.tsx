import type { Sinal } from "@/lib/roleta/engine";
import { acoes } from "@/lib/roleta/store";

export function PopupSinal({ sinal }: { sinal: Sinal }) {
  const isPause = sinal.type === "PAUSE";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border-2 bg-card shadow-2xl" style={{ borderColor: sinal.colorCode }}>
        <section className="flex min-h-[260px] flex-col items-center justify-center px-6 py-8 text-center" style={{ backgroundColor: sinal.colorCode }}>
          <div className="text-xl font-black tracking-widest text-white">{sinal.title}</div>
          <div className="mt-5 text-4xl font-black text-white">{sinal.mainAction}</div>
        </section>
        <section className="min-h-[170px] space-y-3 p-5">
          {sinal.coverageText && <div className="text-base font-medium">✅ COBERTURA: {sinal.coverageText}</div>}
          {sinal.sessionPreference && <div className="text-base font-medium">🎯 SESSÃO: {sinal.sessionPreference}</div>}
          <div className="border-t border-border pt-3 text-xs italic text-muted-foreground">{sinal.footerNote ?? ("Conf: " + sinal.confidence + "%")}</div>
          {isPause && <div className="text-xs italic text-muted-foreground">Não entrar em nada</div>}
          <div className="flex gap-2 pt-1">
            <button onClick={() => acoes.confirmar(sinal.id)} className="flex-1 rounded py-2 text-sm font-black text-white" style={{ backgroundColor: sinal.colorCode }}>CONFIRMAR</button>
            <button onClick={() => acoes.marcarVisto(sinal.id)} className="rounded border border-border px-4 py-2 text-sm font-bold hover:bg-accent">FECHAR</button>
          </div>
        </section>
      </div>
    </div>
  );
}
