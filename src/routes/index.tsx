import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/roleta/AppShell";
import { EntradaNumeros } from "@/components/roleta/EntradaNumeros";
import { SignalPopup } from "@/components/roleta/SignalPopup";
import { SignalTrackingPanel } from "@/components/roleta/SignalTrackingPanel";
import { TabelaCatalogacao } from "@/components/roleta/TabelaCatalogacao";
import { useSinais } from "@/lib/roleta/useSinais";
import { acoes, useEstado } from "@/lib/roleta/store";
import { baixarCSVCatalogacao } from "@/lib/exportCatalogacao";
import { calcularBanca, carregarConfigBanca, carregarDiasBanca, calcularTabelaJuros, diaAtivo } from "@/lib/roleta/bankroll";

const dataLocalISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Catalogação — Roleta" },
      { name: "description", content: "Registro e classificação dos giros da roleta." },
      { property: "og:title", content: "Catalogação — Roleta" },
      { property: "og:description", content: "Registro manual de giros, classificações e marcações BT/BR." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Catalogacao,
});

function Catalogacao() {
  const estado = useEstado();
  const { sinais, smartGale, tracking } = useSinais();
  const configBanca = carregarConfigBanca();
  const resumoBanca = calcularBanca(tracking.signals, configBanca);
  const diaAtual = Math.max(1, Math.min(configBanca.periodoDias, diaAtivo(configBanca, dataLocalISO())));
  const linhaDia = calcularTabelaJuros(configBanca, carregarDiasBanca(), dataLocalISO())[diaAtual - 1];
  const bancaDiaAtivo = linhaDia?.bancaInicial ?? configBanca.bancaInicial;
  const stakeR1Popup = bancaDiaAtivo * configBanca.stakePercentual / 100;
  const stakeR2Popup = stakeR1Popup * 2;
  const metaDiariaAtingida = Boolean(configBanca.bloquearSinaisMetaDiaria && linhaDia && linhaDia.resultadoRealizado !== null && linhaDia.resultadoRealizado >= linhaDia.metaDia);
  const bloqueioFinanceiro = resumoBanca.metaBatida || resumoBanca.stopLossCritico || metaDiariaAtingida;

  return (
    <AppShell>
      {bloqueioFinanceiro ? (
        <div role="alert" className="mb-4 rounded-lg border-2 border-rose-500 bg-rose-500/10 p-3 text-sm font-black text-rose-500">
          SINAIS BLOQUEADOS: {metaDiariaAtingida ? "META DIÁRIA ATINGIDA" : resumoBanca.metaBatida ? "META DA SESSÃO ATINGIDA" : "STOP LOSS CRÍTICO ATINGIDO"}. Encerre a sessão antes de considerar novas entradas.
        </div>
      ) : <SignalPopup signals={sinais} smartGale={smartGale} stakeR1Total={stakeR1Popup} stakeR2Total={stakeR2Popup} />}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-black tracking-widest">CATALOGAÇÃO</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Registro manual ativo · engine VOLT Duplo, DELTA e BR Antecedente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => baixarCSVCatalogacao(estado.spins, estado.bips, tracking.signals)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-black tracking-widest hover:bg-accent"
        >
          EXPORTAR CSV
        </button>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
        <div>
          <p className="text-sm font-bold">Tratamento do ZERO (0)</p>
          <p className="text-xs text-muted-foreground">Permite considerar o zero como proteção e avaliar reentrada VOLT/DELTA.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-black">
          <input
            type="checkbox"
            checked={estado.config.zeroComoProtecao}
            onChange={(event) => acoes.atualizarConfig({ zeroComoProtecao: event.target.checked })}
          />
          ZERO = PROTEÇÃO
        </label>
      </div>
      <div className="space-y-4">
        <SignalTrackingPanel signals={tracking.signals} />
        <EntradaNumeros total={estado.spins.length} />
        <TabelaCatalogacao spins={estado.spins} />
      </div>
    </AppShell>
  );
}
