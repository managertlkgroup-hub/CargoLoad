import { describe, expect, it } from "vitest";

import { computeMetrics } from "@/lib/advanced/metrics";
import { BUILTIN_VEHICLES } from "@/lib/presets/vehicles";
import type { Axle, CargoItem, Placement, VehicleSpec } from "@/types";

/** Rigid 2-осный: 10000×2500×2500, оси у передней (1000) и задней (9000) стенок. */
const rigid: VehicleSpec = {
  id: "t.rigid",
  name: "Тест 2 оси",
  nameEn: "Test rigid",
  builtin: false,
  innerLength: 10000,
  innerWidth: 2500,
  innerHeight: 2500,
  payload: 20000,
  tare: 5000,
  axles: [
    { id: "a.f", label: "Передняя", position: 1000, maxLoad: 9000, tareShare: 0.4 },
    { id: "a.r", label: "Задняя", position: 9000, maxLoad: 9000, tareShare: 0.6 },
  ],
  axleLayout: "rigid",
  loadingSides: ["rear"],
  defaultLoadingSide: "rear",
  bodyType: "test",
};

const euro = BUILTIN_VEHICLES.find((v) => v.id === "vehicle.euro")!;

const gaps = { wall: 0, rowWidth: 0, rowLength: 0 };

function payload(weight: number, x: number, y: number): { item: CargoItem; placement: Placement } {
  const item = {
    id: "box",
    name: "Ящик",
    shape: "box" as const,
    length: 500,
    width: 500,
    height: 500,
    diameter: 0,
    weight,
    quantity: 1,
    stackable: true,
    maxTopLoad: 1000,
    group: "general",
    color: "#8B5CF6",
    cylinderAxis: "up" as const,
    stopIndex: 0,
  };
  const placement: Placement = {
    id: "box:0",
    itemId: "box",
    unitIndex: 0,
    x,
    y,
    z: 0,
    yaw: 0,
    axis: "up",
    stopIndex: 0,
  };
  return { item, placement };
}

function metrics(
  vehicle: VehicleSpec,
  items: CargoItem[],
  placements: Placement[]
) {
  return computeMetrics({ items, placements, unplaced: [], vehicle, mode: "along", gaps });
}

describe("axles: рычажное распределение осевых нагрузок", () => {
  it("пустой кузов: только снаряжённые доли", () => {
    const m = metrics(rigid, [], []);
    expect(m.axlesAvailable).toBe(true);
    const f = m.axles.find((a) => a.axleId === "a.f")!;
    const r = m.axles.find((a) => a.axleId === "a.r")!;
    expect(f.loadKg).toBe(2000); // 0.4 × 5000
    expect(r.loadKg).toBe(3000); // 0.6 × 5000
    expect(f.overloaded).toBe(false);
    expect(r.overloaded).toBe(false);
  });

  it("груз прямо над передней осью почти целиком уходит на неё", () => {
    // COG = 800 + 250 = 1050: плечи 50 (передняя) и 7950 (задняя)
    // доля передней = 7950/(50+7950) = 0.99375 → 993.75 кг из 1000
    const { item: cargo, placement } = payload(1000, 800, 0);
    const m = metrics(rigid, [cargo], [placement]);
    const f = m.axles.find((a) => a.axleId === "a.f")!;
    const r = m.axles.find((a) => a.axleId === "a.r")!;
    expect(f.loadKg).toBeCloseTo(2000 + 993.75, 0);
    expect(r.loadKg).toBeCloseTo(3000 + 6.25, 0);
  });

  it("груз в центре (равные плечи) делится пополам", () => {
    // COG = 4750 + 250 = 5000 — середина между осями 1000 и 9000
    const { item: cargo, placement } = payload(1000, 4750, 0);
    const m = metrics(rigid, [cargo], [placement]);
    const f = m.axles.find((a) => a.axleId === "a.f")!;
    const r = m.axles.find((a) => a.axleId === "a.r")!;
    expect(f.loadKg).toBeCloseTo(2500, 2);
    expect(r.loadKg).toBeCloseTo(3500, 2);
  });

  it("тягач (Еврофура, 5 осей): пресет корректен, сумма = снаряжённая масса", () => {
    expect(euro.axleLayout).toBe("tractor-semi");
    const m = metrics(euro, [], []);
    expect(m.axles).toHaveLength(5);
    const sum = m.axles.reduce((s, a) => s + a.loadKg, 0);
    // AxleLoad.loadKg уже округлён — допуск на округление
    expect(sum).toBeGreaterThan(14490);
    expect(sum).toBeLessThanOrEqual(euro.tare + 1);
    expect(m.axles.every((a) => !a.overloaded)).toBe(true);
  });

  it("полная загрузка: нагрузка на оси превышает допустимое", () => {
    // 20 т в центре Еврофуры → ближайшие оси прицепа перегружены
    const { item: cargo, placement } = payload(20000, 6000, 0); // COG = 6250, ближе к 12600
    const m = metrics(euro, [cargo], [placement]);
    const sum = m.axles.reduce((s, a) => s + a.loadKg, 0);
    expect(sum).toBeCloseTo(euro.tare + 20000, 0);
    expect(m.axles.some((a) => a.overloaded)).toBe(true);
  });

  it("полная загрузка: сумма процентов и нагрузок не уходит в бесконечность", () => {
    const { item: cargo, placement } = payload(20000, 6000, 0);
    const m = metrics(euro, [cargo], [placement]);
    for (const a of m.axles) {
      expect(Number.isFinite(a.pct)).toBe(true);
      expect(a.pct).toBeGreaterThan(0);
    }
  });
});

/** Проверка нейтральной оси (груза нет). */
describe("axles: пресеты тягачей работают с пустым кузовом", () => {
  it("все встроенные пресеты: оси есть, доли суммируются в 1", () => {
    for (const v of BUILTIN_VEHICLES) {
      if (!v.axles.length) continue;
      const shares = v.axles.reduce((s, a: Axle) => s + a.tareShare, 0);
      expect(Math.abs(shares - 1)).toBeLessThanOrEqual(0.02);
      expect(metrics(v, [], []).axles.every((a) => Number.isFinite(a.loadKg))).toBe(true);
    }
  });
});