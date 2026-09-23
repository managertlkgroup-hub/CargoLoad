import { describe, expect, it } from "vitest";

import { computeMetrics } from "@/lib/advanced/metrics";
import { COG_THRESHOLDS } from "@/lib/constants";
import type { CargoItem, Placement, VehicleSpec } from "@/types";

/**
 * LDM и COG: LDM = Σ(площадь пола м²)/2.4, центра тяжести с порогами
 * COG_THRESHOLDS (warn/crit по продольному и поперечному смещению).
 */

function vehicle(overrides: Partial<VehicleSpec> = {}): VehicleSpec {
  return {
    id: "t",
    name: "Тест",
    nameEn: "Test",
    builtin: false,
    innerLength: 10000,
    innerWidth: 2500,
    innerHeight: 3000,
    payload: 15000,
    tare: 0,
    axles: [],
    axleLayout: "rigid",
    loadingSides: ["rear"],
    defaultLoadingSide: "rear",
    bodyType: "test",
    ...overrides,
  };
}

function payload(id: string, length: number, width: number, weight: number): CargoItem {
  return {
    id,
    name: id,
    shape: "box",
    length,
    width,
    height: 600,
    diameter: 0,
    weight,
    quantity: 1,
    stackable: true,
    maxTopLoad: 2000,
    group: "general",
    color: "#8B5CF6",
    cylinderAxis: "up",
    stopIndex: 0,
  };
}

function place(id: string, x: number, y: number, z = 0): Placement {
  return { id: `${id}:0`, itemId: id, unitIndex: 0, x, y, z, yaw: 0, axis: "up", stopIndex: 0 };
}

const gaps = { wall: 0, rowWidth: 0, rowLength: 0 };

describe("ldm: погрузочные метры", () => {
  it("один паллет 1200×800 → 0.96 м² пола → LDM 0.40", () => {
    const items = [payload("p", 1200, 800, 100)];
    const m = computeMetrics({ items, placements: [place("p", 0, 0)], unplaced: [], vehicle: vehicle(), mode: "along", gaps });
    expect(m.floorAreaM2).toBe(0.96);
    expect(m.ldm).toBeCloseTo(0.96 / 2.4, 2);
    expect(m.ldm).toBe(0.4);
  });

  it("штабелированные паллеты занимают ту же площадь пола, но LDM учитывает все единицы", () => {
    const items = [payload("p", 1200, 800, 100)];
    const m = computeMetrics({
      items,
      placements: [place("p", 0, 0), place("p", 0, 0, 600)],
      unplaced: [],
      vehicle: vehicle(),
      mode: "along",
      gaps,
    });
    expect(m.floorAreaM2).toBeCloseTo(1.92, 2);
    expect(m.ldm).toBeCloseTo(1.92 / 2.4, 2);
  });

  it("несколько разных грузов: LDM накапливается", () => {
    const items = [payload("a", 1200, 800, 100), payload("b", 2000, 1000, 100)];
    const placements = [place("a", 0, 0), place("b", 1250, 0)];
    const m = computeMetrics({ items, placements, unplaced: [], vehicle: vehicle(), mode: "along", gaps });
    const area = 1200 * 800 + 2000 * 1000; // 2.96 м²
    expect(m.floorAreaM2).toBeCloseTo(area / 1e6, 2);
    expect(m.ldm).toBeCloseTo(area / 1e6 / 2.4, 2);
    // площадь пола не может превышать площадь кузова
    expect(m.floorAreaM2).toBeLessThanOrEqual((10000 * 2500) / 1e6);
  });
});

describe("cog: центр тяжести и пороги критичности", () => {
  const L = 10000;
  const W = 2500;

  it("центр кузова → ok", () => {
    const items = [payload("c", 500, 500, 100)];
    const m = computeMetrics({ items, placements: [place("c", L / 2 - 250, W / 2 - 250)], unplaced: [], vehicle: vehicle(), mode: "along", gaps });
    expect(m.cog.x).toBeCloseTo(L / 2, 1);
    expect(m.cog.y).toBeCloseTo(W / 2, 1);
    expect(m.cog.longitudinalPct).toBe(0);
    expect(m.cog.lateralPct).toBe(0);
    expect(m.cog.level).toBe("ok");
  });

  it("смещение по длине 10% → warn, 20% → crit", () => {
    const warnOffset = (L * 0.10) / 1; // 10%
    const critOffset = (L * 0.20) / 1; // 20%
    const warn = computeMetrics({
      items: [payload("a", 500, 500, 100)],
      placements: [place("a", L / 2 - 250 + warnOffset, W / 2 - 250)],
      unplaced: [],
      vehicle: vehicle(),
      mode: "along",
      gaps,
    });
    expect(Math.abs(warn.cog.longitudinalPct)).toBeGreaterThan(COG_THRESHOLDS.warnLongitudinal);
    expect(Math.abs(warn.cog.longitudinalPct)).toBeLessThanOrEqual(COG_THRESHOLDS.critLongitudinal);
    expect(warn.cog.level).toBe("warn");

    const crit = computeMetrics({
      items: [payload("b", 500, 500, 100)],
      placements: [place("b", L / 2 - 250 + critOffset, W / 2 - 250)],
      unplaced: [],
      vehicle: vehicle(),
      mode: "along",
      gaps,
    });
    expect(Math.abs(crit.cog.longitudinalPct)).toBeGreaterThan(COG_THRESHOLDS.critLongitudinal);
    expect(crit.cog.level).toBe("crit");
  });

  it("смещение по ширине 5% → warn, 9% → crit", () => {
    const warnOffset = W * 0.05;
    const critOffset = W * 0.09;
    const warn = computeMetrics({
      items: [payload("a", 500, 500, 100)],
      placements: [place("a", L / 2 - 250, W / 2 - 250 + warnOffset)],
      unplaced: [],
      vehicle: vehicle(),
      mode: "along",
      gaps,
    });
    expect(warn.cog.lateralPct).toBeGreaterThan(COG_THRESHOLDS.warnLateral);
    expect(warn.cog.lateralPct).toBeLessThanOrEqual(COG_THRESHOLDS.critLateral);
    expect(warn.cog.level).toBe("warn");

    const crit = computeMetrics({
      items: [payload("b", 500, 500, 100)],
      placements: [place("b", L / 2 - 250, W / 2 - 250 + critOffset)],
      unplaced: [],
      vehicle: vehicle(),
      mode: "along",
      gaps,
    });
    expect(crit.cog.lateralPct).toBeGreaterThan(COG_THRESHOLDS.critLateral);
    expect(crit.cog.level).toBe("crit");
  });

  it("пустой кузов: COG обнулён, уровень ok", () => {
    const m = computeMetrics({ items: [], placements: [], unplaced: [], vehicle: vehicle(), mode: "along", gaps });
    expect(m.cog.x).toBe(0);
    expect(m.cog.y).toBe(0);
    expect(m.cog.z).toBe(0);
    expect(m.cog.level).toBe("ok");
  });
});