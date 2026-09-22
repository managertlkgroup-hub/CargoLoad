import { describe, expect, it } from "vitest";

import {
  accessDepth,
  isSideLoading,
  loadingProfile,
} from "@/lib/advanced/loading-types";
import { packLayout } from "@/lib/packing/core";
import { BUILTIN_VEHICLES } from "@/lib/presets/vehicles";
import type { CargoItem, Gaps } from "@/types";

const kamaz = BUILTIN_VEHICLES.find((v) => v.id === "vehicle.kamaz")!;
const NO_GAP: Gaps = { wall: 0, rowWidth: 0, rowLength: 0 };

function box(id: string): CargoItem {
  return {
    id,
    name: id,
    shape: "box",
    length: 300,
    width: 300,
    height: 200,
    diameter: 0,
    weight: 5,
    quantity: 3,
    stackable: false,
    maxTopLoad: 0,
    group: "general",
    color: "#000000",
    cylinderAxis: "up",
    stopIndex: 0,
  };
}

describe("loading-types: профили сторон загрузки", () => {
  it("rear: доступ вдоль X, свободная выгрузка", () => {
    expect(loadingProfile("rear")).toEqual({
      side: "rear",
      depthAxis: "x",
      accessAxis: "x",
      freeAccess: true,
    });
  });

  it("right/left: глубина по Y, боковой доступ", () => {
    expect(loadingProfile("right").depthAxis).toBe("y");
    expect(loadingProfile("left").depthAxis).toBe("y");
    expect(loadingProfile("right").freeAccess).toBe(false);
    expect(isSideLoading("right")).toBe(true);
    expect(isSideLoading("top")).toBe(false);
  });

  it("top: глубина по X", () => {
    expect(loadingProfile("top").depthAxis).toBe("x");
  });

  it("accessDepth: задняя дверь — конец кузова", () => {
    expect(accessDepth("rear")).toBe(1);
    expect(accessDepth("right")).toBe(0.5);
    expect(accessDepth("top")).toBe(1);
  });

  it("правый борт: заполнение колоннами по Y (одинаковый X у первых)", () => {
    const r = packLayout({
      items: [box("b")],
      vehicle: kamaz,
      mode: "along",
      gaps: NO_GAP,
      stacking: false,
      maxLayers: 0,
      lifo: false,
      loadingSide: "right",
    });
    expect(r.unplaced).toHaveLength(0);
    const ps = [...r.placements].sort((a, b) => b.z - a.z || a.x - b.x || a.y - b.y);
    const p0 = ps[0];
    const p1 = ps[1] ?? p0;
    if (p0.z === 0) {
      expect(p1.x).toBe(p0.x);
      expect(p1.y).toBeGreaterThan(p0.y);
    }
  });

  it("задняя дверь: заполнение рядами по X (одинаковый Y у первых)", () => {
    const r = packLayout({
      items: [box("b")],
      vehicle: kamaz,
      mode: "along",
      gaps: NO_GAP,
      stacking: false,
      maxLayers: 0,
      lifo: false,
      loadingSide: "rear",
    });
    expect(r.unplaced).toHaveLength(0);
    const ps = [...r.placements].sort((a, b) => b.z - a.z || a.x - b.x || a.y - b.y);
    const p0 = ps[0];
    const p1 = ps[1] ?? p0;
    if (p0.z === 0) {
      expect(p1.y).toBe(p0.y);
      expect(p1.x).toBeGreaterThan(p0.x);
    }
  });
});