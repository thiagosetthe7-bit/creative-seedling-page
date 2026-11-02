import type { TrackedSignal } from "./signalTracking";
import type { EditableSignalResult, SessionFinanceLedger } from "./sessionFinance";

export interface ReliabilityRecord { id: string; key: string; result: "GREEN" | "RED"; }
export interface ReliabilitySummary { percent: number | null; sampleSize: number; level: "HIGH" | "LOW" | "INSUFFICIENT"; }
const KEY = "roleta-signal-reliability-v1";
const EVENT = "roleta:signal-reliability-updated";
let revision = 0;

function read(): ReliabilityRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(value) ? value.filter((item) => item && typeof item.id === "string" && typeof item.key === "string" && (item.result === "GREEN" || item.result === "RED")) : [];
  } catch { return []; }
}
function targetKey(signal: Pick<TrackedSignal, "strategy" | "target">): string {
  return `${signal.strategy}|${signal.target.trim().toLocaleUpperCase("pt-BR").replace(/\\s+/g, " ")}`;
}
export function syncReliabilityHistory(signals: TrackedSignal[], ledger: SessionFinanceLedger): void {
  if (typeof window === "undefined") return;
  const records = new Map(read().map((item) => [item.id, item]));
  for (const signal of signals) {
    if (ledger.removedSignalIds.includes(signal.id)) { records.delete(signal.id); continue; }
    const result: EditableSignalResult = ledger.corrections[signal.id] ?? (signal.preCatalog ? "NOT_PICKED" : signal.result);
    if (result === "GREEN_R1" || result === "GREEN_GALE1") records.set(signal.id, { id: signal.id, key: targetKey(signal), result: "GREEN" });
    else if (result === "RED") records.set(signal.id, { id: signal.id, key: targetKey(signal), result: "RED" });
    else records.delete(signal.id);
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(Array.from(records.values())));
    revision++;
    window.dispatchEvent(new Event(EVENT));
  } catch { /* armazenamento indisponível */ }
}
export function getReliability(strategy: string, target: string): ReliabilitySummary {
  const key = `${strategy}|${target.trim().toLocaleUpperCase("pt-BR").replace(/\\s+/g, " ")}`;
  const matching = read().filter((item) => item.key === key);
  const sampleSize = matching.length;
  const greens = matching.filter((item) => item.result === "GREEN").length;
  const percent = sampleSize ? (greens / sampleSize) * 100 : null;
  return { percent, sampleSize, level: sampleSize === 0 ? "INSUFFICIENT" : percent! >= 75 ? "HIGH" : "LOW" };
}
export function subscribeReliability(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const update = () => { revision++; callback(); };
  window.addEventListener(EVENT, update);
  window.addEventListener("storage", update);
  return () => { window.removeEventListener(EVENT, update); window.removeEventListener("storage", update); };
}
export function getReliabilityVersion(): number { return revision; }
