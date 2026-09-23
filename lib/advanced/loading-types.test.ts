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

  it("сторона загрузки не влияет на раскладку: rear/right/left дают одно и то же", () => {
    const items = [box("b")];
    const run = (loadingSide: "rear" | "right" | "left") =>
      packLayout({
        items,
        vehicle: kamaz,
        mode: "along",
        gaps: NO_GAP,
        stacking: false,
        maxLayers: 0,
        lifo: false,
        loadingSide,
      });
    for (const side of ["rear", "right", "left"] as const) {
      expect(run(side).unplaced).toHaveLength(0);
    }
    const pickup = (r: ReturnType<typeof run>) =>
      r.placements
        .map((p) => [p.x, p.y, p.z, p.yaw])
        .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    expect(pickup(run("right"))).toEqual(pickup(run("rear")));
    expect(pickup(run("left"))).toEqual(pickup(run("rear")));
  });

  it("заполнение: сначала столбец по Y, затем следующий ряд по X", () => {
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
    const ps = [...r.placements].sort((a, b) => a.z - b.z || a.x - b.x || a.y - b.y);
    // 3 квадрата 300×300 свободно встают друг за другом вдоль Y (2400 мм)
    expect(ps[1].x).toBe(ps[0].x);
    expect(ps[1].y).toBeGreaterThan(ps[0].y);
    expect(ps[2].x).toBe(ps[0].x);
    expect(ps[2].y).toBeGreaterThan(ps[1].y);
  });
});