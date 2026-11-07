import { useMemo } from "react";
import { useEstado } from "./store";
import { evaluateMacroMemory } from "./macroMemoryEngine";
import type { TrackedSignal } from "./signalTracking";

function matchesTarget(spin: ReturnType<typeof useEstado>["spins"][number], rawTarget: string): boolean {
  if (spin.numero === 0) return false;
  const target = rawTarget.trim().toUpperCase();
  const c = spin.classificacao;
  const pair = target.match(/^(?:DÚZIAS|DUZIAS|DÚZIA|DUZIA)\s+(.+)$/);
  if (pair) return pair[1]!.split(/\s*\+\s*/).includes(c.duzia);
  const col = target.match(/^COLUNAS?\s+(.+)$/);
  if (col) return col[1]!.split(/\s*\+\s*/).includes(c.coluna);
  const match = target.match(/^(COR|TERMINAL|CAVALO|ALTO\/BAIXO|PAR\/ÍMPAR|P\/I|A\/B|TIPO|SEÇÃO|SECAO):?\s*(.+)$/);
  if (!match) return false;
  const [, label, expected] = match;
  const actual: Record<string, string> = { COR: c.cor, TERMINAL: c.terminal, CAVALO: c.cavalo, "ALTO/BAIXO": c.ab, "P/I": c.pi, "PAR/ÍMPAR": c.pi, "A/B": c.ab, TIPO: c.tipo, "SEÇÃO": c.secao, SECAO: c.secao };
  return (actual[label!] ?? "").toUpperCase() === expected!.trim().toUpperCase().replace("Í", "I");
}

export function useSinais() {
  const estado = useEstado();
  const macro = useMemo(() => evaluateMacroMemory(estado.spins), [estado.spins]);
  const tracking = useMemo(() => {
    const byId = new Map<string, TrackedSignal>();
    const spins = estado.spins;
    spins.forEach((spin, index) => {
      const assessment = evaluateMacroMemory(spins.slice(0, index + 1));
      for (const signal of assessment.signals) {
        if (byId.has(signal.id)) continue;
        const sourceIndex = spins.findIndex((item) => item.id === signal.sourceSpinId);
        if (sourceIndex < 0) continue;
        const r1 = spins[sourceIndex + 1];
        const gale = spins[sourceIndex + 2];
        const hit = (candidate: typeof spin | undefined) => Boolean(candidate && matchesTarget(candidate, signal.target) && (!signal.deltaTarget || matchesTarget(candidate, signal.deltaTarget)));
        let result: TrackedSignal["result"] = "NO_SIGNAL";
        let status: TrackedSignal["status"] = "AGUARDANDO R1";
        let phase: TrackedSignal["phase"] = "R1";
        let resolvedNumber: number | undefined;
        let resultSpinId: string | undefined;
        if (r1 && hit(r1)) {
          result = "GREEN_R1"; status = "CONCLUÍDO"; resolvedNumber = r1.numero; resultSpinId = r1.id;
        } else if (r1 && gale && hit(gale)) {
          result = "GREEN_GALE1"; status = "CONCLUÍDO"; phase = "GALE1"; resolvedNumber = gale.numero; resultSpinId = gale.id;
        } else if (r1 && gale) {
          result = "RED"; status = "CONCLUÍDO"; phase = "GALE1"; resolvedNumber = gale.numero; resultSpinId = gale.id;
        } else if (r1) {
          status = "GALE 1 EM ANDAMENTO"; phase = "GALE1"; resultSpinId = r1.id;
        }
        byId.set(signal.id, {
          id: signal.id, sourceSpinId: signal.sourceSpinId, sourceIndex: sourceIndex + 1,
          strategy: signal.strategy, strategyLabel: signal.name, target: signal.target, deltaTarget: signal.deltaTarget,
          action: signal.action, explanation: signal.explanation, status, result, phase,
          r1Number: r1?.numero, resolvedNumber, resultSpinId, preCatalog: false,
        });
      }
    });
    return Array.from(byId.values()).sort((a, b) => a.sourceIndex - b.sourceIndex);
  }, [estado.spins]);
  const signals = macro.signals.map((signal) => ({ ...signal, macroState: macro.status }));
  const calibration = { status: macro.status, message: macro.message, altCount: macro.altCount, streakCount: macro.streakCount, spinIndex: macro.spinCount, windowSize: macro.windowSize };
  return {
    sinais: signals, alertas: signals, superGatilho: macro.status === "HIGH_SIGNAL",
    smartGale: null, tracking: { version: 1 as const, lastProcessedSpinId: estado.spins.at(-1)?.id ?? null, signals: tracking },
    blockedTargets: [], marketEntropy: { isMarketSafe: macro.status !== "BLOCK", dominantSector: null, concentration: 0, hasIsolatedBreaks: false },
    zeroQuarantineActive: false, sessionAssessment: { sessionStatus: macro.status, sampleSize: macro.windowSize },
    calibration, macro,
  };
}
