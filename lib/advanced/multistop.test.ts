import { describe, expect, it } from "vitest";

import {
  clampStopIndex,
  computeStopStats,
  defaultStops,
  loadingOrder,
  loadingRank,
} from "@/lib/advanced/multistop";
import { packLayout } from "@/lib/packing/core";
import { BUILTIN_VEHICLES } from "@/lib/presets/vehicles";
import type { CargoItem, Gaps, Placement } from "@/types";

const kamaz = BUILTIN_VEHICLES.find((v) => v.id === "vehicle.kamaz")!;

const NO_GAP: Gaps = { wall: 0, rowWidth: 0, rowLength: 0 };

function makeItem(patch: Partial<CargoItem> & { id: string }): CargoItem {
  return {
    name: patch.id,
    shape: "box",
    length: 600,
    width: 400,
    height: 400,
    diameter: 0,
    weight: 10,
    quantity: 1,
    stackable: true,
    maxTopLoad: 500,
    group: "general",
    color: "#8B5CF6",
    cylinderAxis: "up",
    stopIndex: 0,
    ...patch,
  };
}

describe("multistop: LIFO раскладка по трём точкам", () => {
  it("lifo=true: последняя точка — ближе к двери, первая — глубже", () => {
    const items = [
      makeItem({ id: "stop0", stopIndex: 0, quantity: 6 }),
      makeItem({ id: "stop1", stopIndex: 1, quantity: 6 }),
      makeItem({ id: "stop2", stopIndex: 2, quantity: 6 }),
    ];
    const r = packLayout({
      items,
      vehicle: kamaz,
      mode: "along",
      gaps: NO_GAP,
      stacking: false,
      maxLayers: 0,
      lifo: true,
      loadingSide: "rear",
    });
    expect(r.unplaced).toHaveLength(0);
    const x = (id: string) => {
      const xs = r.placements.filter((p) => p.itemId === id).map((p) => p.x);
      return Math.min(...xs);
    };
    // загрузка от передней стенки (x=0), выгрузка у задней двери (x=L):
    // полоса (ряд по Y) целиком занимает одну точку выгрузки
    expect(x("stop2")).toBeLessThan(x("stop1"));
    expect(x("stop1")).toBeLessThan(x("stop0"));
  });

  it("lifo=false: первая точка загружается первой (глубже)", () => {
    const items = [
      makeItem({ id: "stop0", stopIndex: 0, quantity: 6 }),
      makeItem({ id: "stop1", stopIndex: 1, quantity: 6 }),
      makeItem({ id: "stop2", stopIndex: 2, quantity: 6 }),
    ];
    const r = packLayout({
      items,
      vehicle: kamaz,
      mode: "along",
      gaps: NO_GAP,
      stacking: false,
      maxLayers: 0,
      lifo: false,
      loadingSide: "rear",
    });
    expect(r.unplaced).toHaveLength(0);
    const x = (id: string) => {
      const xs = r.placements.filter((p) => p.itemId === id).map((p) => p.x);
      return Math.min(...xs);
    };
    expect(x("stop0")).toBeLessThan(x("stop1"));
    expect(x("stop1")).toBeLessThan(x("stop2"));
  });

  it("loadingRank: LIFO — последняя точка грузится первой", () => {
    expect(loadingRank(0, 3, true)).toBe(2);
    expect(loadingRank(1, 3, true)).toBe(1);
    expect(loadingRank(2, 3, true)).toBe(0);
    expect(loadingRank(0, 3, false)).toBe(0);
    expect(loadingRank(2, 3, false)).toBe(2);
    expect(loadingRank(9, 3, true)).toBe(0);
  });

  it("loadingOrder сортирует точки в порядке загрузки", () => {
    expect(loadingOrder([0, 2, 1], 3, true)).toEqual([2, 1, 0]);
    expect(loadingOrder([0, 2, 1], 3, false)).toEqual([0, 1, 2]);
    expect(loadingOrder([0], 1, true)).toEqual([0]);
  });

  it("clampStopIndex ограничивает диапазон", () => {
    expect(clampStopIndex(-3, 3)).toBe(0);
    expect(clampStopIndex(5, 3)).toBe(2);
    expect(clampStopIndex(1, 0)).toBe(0);
    expect(clampStopIndex(1.7, 3)).toBe(2);
  });

  it("computeStopStats: веса и объёмы по точкам", () => {
    const items = [
      makeItem({ id: "a", stopIndex: 0, weight: 10 }),
      makeItem({ id: "b", stopIndex: 1, weight: 20, quantity: 2 }),
    ];
    const placement = (
      id: string,
      itemId: string,
      unitIndex: number,
      stopIndex: number
    ): Placement => ({ id, itemId, unitIndex, x: 0, y: 0, z: 0, yaw: 0, axis: "up", stopIndex });
    const placements = [
      placement("a:0", "a", 0, 0),
      placement("b:0", "b", 0, 1),
      placement("b:1", "b", 1, 1),
    ];
    const stats = computeStopStats(items, placements);
    expect(stats).toHaveLength(2);
    expect(stats[0]).toMatchObject({ stopIndex: 0, units: 1, weightKg: 10 });
    expect(stats[0].volumeM3).toBe(0.1);
    expect(stats[1]).toMatchObject({ stopIndex: 1, units: 2, weightKg: 40 });
  });

  it("defaultStops: единственная точка по умолчанию", () => {
    const stops = defaultStops();
    expect(stops).toHaveLength(1);
    expect(stops[0].id).toBe("stop.main");
  });

  it("computeStopStats на реальной раскладке трёх точек", () => {
    const items = [
      makeItem({ id: "s0", stopIndex: 0, weight: 100, quantity: 6 }),
      makeItem({ id: "s1", stopIndex: 1, weight: 100, quantity: 4 }),
      makeItem({ id: "s2", stopIndex: 2, weight: 100, quantity: 2 }),
    ];
    const r = packLayout({
      items,
      vehicle: kamaz,
      mode: "along",
      gaps: NO_GAP,
      stacking: false,
      maxLayers: 0,
      lifo: true,
      loadingSide: "rear",
    });
    expect(r.unplaced).toHaveLength(0);
    const stats = computeStopStats(items, r.placements);
    expect(stats.map((s) => s.stopIndex)).toEqual([0, 1, 2]);
    const byStop = Object.fromEntries(stats.map((s) => [s.stopIndex, s]));
    expect(byStop[0]).toMatchObject({ units: 6, weightKg: 600 });
    expect(byStop[1]).toMatchObject({ units: 4, weightKg: 400 });
    expect(byStop[2]).toMatchObject({ units: 2, weightKg: 200 });
    // объёмы согласованы с unitVolume (600×400×400 = 0.096 м³)
    expect(byStop[0].volumeM3).toBeCloseTo(0.58, 2);
    // нагрузка складывается в вес кузова
    const total = stats.reduce((s, x) => s + x.weightKg, 0);
    expect(total).toBe(1200);
  });
});