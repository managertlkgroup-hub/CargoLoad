import { unitVolume } from "@/lib/geometry";
import { roundTo } from "@/lib/units";
import type { CargoItem, LoadStop, Placement } from "@/types";

/** Мульти-стоп оркестрация поверх ядра упаковки (LIFO-порядок в core.ts). */

export const MAIN_STOP_ID = "stop.main";

export function defaultStops(): LoadStop[] {
  return [{ id: MAIN_STOP_ID, name: "Основная доставка" }];
}

export function clampStopIndex(value: number, stopCount: number): number {
  if (!stopCount || stopCount <= 0) return 0;
  return Math.max(0, Math.min(Math.round(value), stopCount - 1));
}

export function loadingRank(stopIndex: number, stopCount: number, lifo: boolean): number {
  const clamped = clampStopIndex(stopIndex, stopCount);
  return lifo ? stopCount - 1 - clamped : clamped;
}

export function loadingOrder(
  stopIndices: number[],
  stopCount: number,
  lifo: boolean
): number[] {
  return [...new Set(stopIndices)]
    .map((s) => clampStopIndex(s, stopCount))
    .sort(
      (a, b) =>
        loadingRank(a, stopCount, lifo) - loadingRank(b, stopCount, lifo) ||
        (lifo ? b - a : a - b)
    );
}

export interface StopStats {
  stopIndex: number;
  units: number;
  weightKg: number;
  volumeM3: number;
}

export function computeStopStats(
  items: CargoItem[],
  placements: Placement[]
): StopStats[] {
  const byItem = new Map(items.map((i) => [i.id, i]));
  const acc = new Map<number, StopStats>();
  for (const p of placements) {
    const item = byItem.get(p.itemId);
    if (!item) continue;
    const cur = acc.get(p.stopIndex) ?? {
      stopIndex: p.stopIndex,
      units: 0,
      weightKg: 0,
      volumeM3: 0,
    };
    cur.units += 1;
    cur.weightKg += item.weight;
    cur.volumeM3 += unitVolume(item) / 1e9;
    acc.set(p.stopIndex, cur);
  }
  const stats = [...acc.values()].sort((a, b) => a.stopIndex - b.stopIndex);
  for (const s of stats) {
    s.weightKg = roundTo(s.weightKg, 2);
    s.volumeM3 = roundTo(s.volumeM3, 2);
  }
  return stats;
}