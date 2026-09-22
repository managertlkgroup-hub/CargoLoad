import { describe, expect, it } from "vitest";

import { computeMetrics } from "@/lib/advanced/metrics";
import type { CargoItem, Placement, VehicleSpec } from "@/types";

const vehicle: VehicleSpec = {
  id: "test",
  name: "Тест",
  nameEn: "Test",
  builtin: false,
  innerLength: 1000,
  innerWidth: 1000,
  innerHeight: 1000,
  payload: 1000,
  tare: 200,
  axles: [
    { id: "f", label: "Передняя", position: 200, maxLoad: 600, tareShare: 0.4 },
    { id: "r", label: "Задняя", position: 800, maxLoad: 800, tareShare: 0.6 },
  ],
  axleLayout: "rigid",
  loadingSides: ["rear", "right", "left", "top"],
  defaultLoadingSide: "rear",
  bodyType: "tent",
};

const item: CargoItem = {
  id: "a",
  name: "Ящик",
  shape: "box",
  length: 500,
  width: 500,
  height: 500,
  diameter: 0,
  weight: 100,
  quantity: 2,
  stackable: true,
  maxTopLoad: 1000,
  group: "general",
  color: "#8B5CF6",
  cylinderAxis: "up",
  stopIndex: 0,
};

const placements: Placement[] = [
  {
    id: "p0",
    itemId: "a",
    unitIndex: 0,
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    axis: "up",
    stopIndex: 0,
  },
  {
    id: "p1",
    itemId: "a",
    unitIndex: 1,
    x: 0,
    y: 0,
    z: 500,
    yaw: 0,
    axis: "up",
    stopIndex: 0,
  },
];

const gaps = { wall: 10, rowWidth: 10, rowLength: 20 };

describe("computeMetrics", () => {
  it("считает объём/вес с округлением на границе", () => {
    const m = computeMetrics({ items: [item], placements, unplaced: [], vehicle, mode: "along", gaps });
    expect(m.volumeTotalM3).toBe(1);
    expect(m.volumeUsedM3).toBe(0.25);
    expect(m.volumeFreeM3).toBe(0.75);
    expect(m.volumePct).toBe(25);
    expect(m.weightUsedKg).toBe(200);
    expect(m.weightFreeKg).toBe(800);
    expect(m.weightPct).toBe(20);
  });

  it("считает габариты укладки без и с зазорами", () => {
    const m = computeMetrics({ items: [item], placements, unplaced: [], vehicle, mode: "along", gaps });
    expect(m.bboxNoGaps).toEqual({ length: 500, width: 500, height: 1000 });
    // 500 + 2×wall(10) + rowLength(20) / rowWidth(10)
    expect(m.bboxWithGaps).toEqual({ length: 540, width: 530, height: 1000 });
  });

  it("анализирует слои и LDM", () => {
    const m = computeMetrics({ items: [item], placements, unplaced: [], vehicle, mode: "along", gaps });
    expect(m.currentLayers).toBe(2);
    expect(m.canStack).toBe(true);
    expect(m.maxLayers).toBe(2);
    expect(m.floorAreaM2).toBe(0.5);
    expect(m.ldm).toBe(0.21);
  });

  it("считает COG и уровень критичности", () => {
    const m = computeMetrics({ items: [item], placements, unplaced: [], vehicle, mode: "along", gaps });
    expect(m.cog.x).toBe(250);
    expect(m.cog.y).toBe(250);
    expect(m.cog.z).toBe(500);
    expect(m.cog.longitudinalPct).toBe(-25);
    expect(m.cog.level).toBe("crit");
  });

  it("распределяет груз по осям рычагом", () => {
    const m = computeMetrics({ items: [item], placements, unplaced: [], vehicle, mode: "along", gaps });
    // груз 200 кг, COG x=250 → передняя (200) и задняя (800) — ближайшие две
    const front = m.axles.find((a) => a.axleId === "f")!;
    const rear = m.axles.find((a) => a.axleId === "r")!;
    // передняя: 80 (снаряжённая) + 200×550/600 ≈ 263.33
    expect(front.loadKg).toBeCloseTo(263.33, 2);
    expect(front.pct).toBeCloseTo(43.9, 1);
    expect(front.overloaded).toBe(false);
    // задняя: 120 + 200×50/600 ≈ 136.67
    expect(rear.loadKg).toBeCloseTo(136.67, 2);
  });

  it("показвает неразмещённых с весом и габаритами", () => {
    const m = computeMetrics({
      items: [item],
      placements: [placements[0]],
      unplaced: [{ itemId: "a", quantity: 1, reason: "no-space" }],
      vehicle,
      mode: "along",
      gaps,
    });
    expect(m.placedCount).toBe(1);
    expect(m.unplaced).toHaveLength(1);
    expect(m.unplaced[0]).toMatchObject({
      name: "Ящик",
      quantity: 1,
      weight: 100,
      length: 500,
      width: 500,
      height: 500,
      reason: "no-space",
    });
  });

  it("возвращает нули при пустой раскладке", () => {
    const m = computeMetrics({ items: [item], placements: [], unplaced: [], vehicle, mode: "along", gaps });
    expect(m.placedCount).toBe(0);
    expect(m.bboxNoGaps).toEqual({ length: 0, width: 0, height: 0 });
    expect(m.currentLayers).toBe(0);
    expect(m.canStack).toBe(false);
    expect(m.cog.level).toBe("ok");
  });
});