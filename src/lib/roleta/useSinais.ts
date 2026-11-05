import { useMemo, useSyncExternalStore } from "react";
import { detectarSinaisEntrada, isSuperGatilho } from "./signalEngine";
import { useEstado } from "./store";
import type { TrackedSignal } from "./signalTracking";
import { getReliability, getReliabilityVersion, subscribeReliability } from "./signalReliability";
import { evaluateMasterSessionSafety, orderSignalsByMasterWeight } from "./signalCalibration";

export function useSinais() {
  const estado = useEstado();
  useSyncExternalStore(subscribeReliability, getReliabilityVersion, () => 0);
  const sinaisDetectados = useMemo(
    () => detectarSinaisEntrada(estado.spins, estado.bips),
    [estado.spins, estado.bips],
  );

  // Reconstrói os sinais a partir do histórico e liquida R1/Gale 1 com os giros posteriores.
  const trackedSignals = useMemo<TrackedSignal[]>(() => {
    const byId = new Map<string, TrackedSignal>();
    const spins = estado.spins;

    const matchesTarget = (spin: typeof spins[number], rawTarget: string): boolean => {
      if (spin.numero === 0) return false;
      const target = rawTarget.trim().toUpperCase();
      const classification = spin.classificacao;
      const pairMatch = target.match(/^(?:DÚZIAS|DUZIAS|DÚZIA|DUZIA)\s+(.+)$/);
      if (pairMatch) return pairMatch[1]!.split(/\s*\+\s*/).includes(classification.duzia);
      const columnMatch = target.match(/^COLUNAS?\s+(.+)$/);
      if (columnMatch) return columnMatch[1]!.split(/\s*\+\s*/).includes(classification.coluna);

      const valueMatch = target.match(/^(COR|TERMINAL|CAVALO|ALTO\/BAIXO|PAR\/ÍMPAR|P\/I|A\/B|TIPO|SEÇÃO|SECAO):?\s*(.+)$/);
      if (!valueMatch) return false;
      const [, label, expectedRaw] = valueMatch;
      const expected = expectedRaw!.trim().replace(/^•\s*/, "");
      const actualByLabel: Record<string, string> = {
        COR: classification.cor,
        TERMINAL: classification.terminal,
        CAVALO: classification.cavalo,
        "ALTO/BAIXO": classification.ab,
        "PAR/ÍMPAR": classification.pi,
        "P/I": classification.pi,
        "A/B": classification.ab,
        TIPO: classification.tipo,
        "SEÇÃO": classification.secao,
        SECAO: classification.secao,
      };
      const actual = actualByLabel[label!] ?? "";
      return actual.toUpperCase() === expected ||
        (label === "PAR/ÍMPAR" || label === "P/I") && actual.toUpperCase() === expected.replace("Í", "I");
    };

    spins.forEach((spin, index) => {
      const signalsAtSpin = detectarSinaisEntrada(spins.slice(0, index + 1), estado.bips);
      signalsAtSpin.forEach((signal) => {
        if (byId.has(signal.id)) return;
        const sourceIndex = spins.findIndex((candidate) => candidate.id === signal.sourceSpinId);
        if (sourceIndex < 0) return;
        const preCatalog = sourceIndex + 1 <= 20;
        const r1Spin = spins[sourceIndex + 1];
        const gale1Spin = spins[sourceIndex + 2];
        const hit = (resultSpin: typeof spins[number] | undefined) => Boolean(
          resultSpin &&
          matchesTarget(resultSpin, signal.target) &&
          (!signal.deltaTarget || matchesTarget(resultSpin, signal.deltaTarget))
        );
        const contraryInertia = (r1Index: number): boolean => {
          const recent = spins.slice(Math.max(0, r1Index - 4), r1Index + 1).filter((item) => item.numero !== 0);
          const misses = recent.filter((item) => !hit(item)).length;
          const lastThreeOppose = recent.length >= 3 && recent.slice(-3).every((item) => !hit(item));
          return misses >= 4 || lastThreeOppose;
        };

        let result: TrackedSignal["result"] = "NO_SIGNAL";
        let status: TrackedSignal["status"] = "CONCLUÍDO";
        let phase: TrackedSignal["phase"] = "R1";
        let r1Number: number | undefined;
        let resolvedNumber: number | undefined;
        let resultSpinId: string | undefined;
        let blockReason: string | undefined;

        // Pré-catalogação também liquida o resultado técnico para auditoria visual.
        // O isolamento financeiro é aplicado pelo status NOT_PICKED no ledger.
        if (!r1Spin) {
          result = "NO_SIGNAL";
          status = "AGUARDANDO R1";
        } else if (hit(r1Spin)) {
          result = "GREEN_R1";
          r1Number = r1Spin.numero;
          resolvedNumber = r1Spin.numero;
          resultSpinId = r1Spin.id;
        } else if (contraryInertia(sourceIndex + 1)) {
          result = "GALE_BLOCKED";
          status = "GALE 1 BLOQUEADO";
          phase = "GALE1";
          r1Number = r1Spin.numero;
          resolvedNumber = r1Spin.numero;
          resultSpinId = r1Spin.id;
          blockReason = "Inércia contrária forte detetada. Proteja a banca e aguarde o próximo ciclo.";
        } else if (!gale1Spin) {
          result = "NO_SIGNAL";
          status = "GALE 1 EM ANDAMENTO";
          phase = "GALE1";
          r1Number = r1Spin.numero;
          resultSpinId = r1Spin.id;
        } else if (hit(gale1Spin)) {
          result = "GREEN_GALE1";
          phase = "GALE1";
          r1Number = r1Spin.numero;
          resolvedNumber = gale1Spin.numero;
          resultSpinId = gale1Spin.id;
        } else {
          result = "RED";
          phase = "GALE1";
          r1Number = r1Spin.numero;
          resolvedNumber = gale1Spin.numero;
          resultSpinId = gale1Spin.id;
        }

        byId.set(signal.id, {
          id: signal.id,
          sourceSpinId: signal.sourceSpinId,
          sourceIndex: sourceIndex + 1,
          strategy: signal.strategy,
          strategyLabel: signal.name,
          target: signal.target,
          deltaTarget: signal.deltaTarget,
          action: signal.action,
          explanation: signal.explanation,
          status,
          result,
          phase,
          r1Number,
          resolvedNumber,
          resultSpinId,
          preCatalog,
          blockReason,
        });
      });
    });
    return Array.from(byId.values()).sort((a, b) => a.sourceIndex - b.sourceIndex);
  }, [estado.spins, estado.bips]);

  const calibration = evaluateMasterSessionSafety(estado.spins.length, estado.spins, trackedSignals);
  const eligibleSignals = calibration.suppressPopups ? [] : sinaisDetectados.filter((signal) =>
    !(calibration.blockDeltaA && signal.strategy === "delta-a")
  );
  const sinais = orderSignalsByMasterWeight(estado.spins.length > 20 ? eligibleSignals : []);

  const recoveryAlerts = trackedSignals.filter((signal) => !signal.preCatalog && (signal.status === "GALE 1 EM ANDAMENTO" || signal.status === "GALE 1 BLOQUEADO")).filter((signal) => signal.r1Number !== undefined && signal.resultSpinId === estado.spins.at(-1)?.id).map((signal) => ({
    id: `${signal.id}:recovery:${signal.status}`,
    strategy: signal.strategy,
    name: signal.strategyLabel,
    target: signal.target,
    deltaTarget: signal.deltaTarget,
    explanation: signal.explanation,
    action: signal.status === "GALE 1 BLOQUEADO" ? "Gale 1 bloqueado por inércia contrária." : "R1 não atingiu o alvo. Avalie a recuperação Smart Gale 1.",
    sourceSpinId: signal.sourceSpinId,
    phase: "GALE1" as const,
    blocked: signal.status === "GALE 1 BLOQUEADO",
    blockedReason: signal.blockReason,
  }));
  const eligibleRecoveryAlerts = calibration.suppressPopups ? [] : recoveryAlerts.filter((signal) => !(calibration.blockDeltaA && signal.strategy === "delta-a"));
  const liveAlerts = estado.spins.length > 20 ? [...sinais, ...eligibleRecoveryAlerts].map((signal) => {
    const reliability = getReliability(signal.strategy, signal.target);
    return { ...signal, confidencePercent: reliability.percent ?? undefined, confidenceSampleSize: reliability.sampleSize, confidenceLevel: reliability.level };
  }) : [];
  return {
    sinais: liveAlerts,
    alertas: liveAlerts,
    superGatilho: isSuperGatilho(sinais),
    smartGale: null,
    tracking: { version: 1 as const, lastProcessedSpinId: estado.spins.at(-1)?.id ?? null, signals: trackedSignals },
    blockedTargets: [],
    marketEntropy: { isMarketSafe: false, dominantSector: null, concentration: 0, hasIsolatedBreaks: false },
    zeroQuarantineActive: false,
    sessionAssessment: { sessionStatus: calibration.status, sampleSize: estado.spins.length },
    calibration,
  };
}
