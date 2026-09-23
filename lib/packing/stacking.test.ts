import { describe, expect, it } from "vitest";

import { placementBox, supportRatio } from "@/lib/packing/collide";
import { packLayout } from "@/lib/packing/core";
import { BUILTIN_VEHICLES } from "@/lib/presets/vehicles";
import type { CargoItem, Gaps, PackRequest } from "@/types";

/**
 * Стекинг: ограничение слоёв, опора, нагрузка сверху (maxTopLoad),
 * совместимость групп и форм (цилиндры). Все проверки — через чистое ядро.
 */

const kamaz = BUILTIN_VEHICLES.find((v) => v.id === "vehicle.kamaz")!;
const NO_GAP: Gaps = { wall: 0, rowWidth: 0, rowLength: 0 };

function box(patch: Partial<CargoItem> & { id: string }, quantity = 1): CargoItem {
  return {
    name: patch.id,
    shape: "box",
    length: 600,
    width: 400,
    height: 400,
    diameter: 0,
    weight: 50,
    quantity,
    stackable: true,
    maxTopLoad: 500,
    group: "general",
    color: "#8B5CF6",
    cylinderAxis: "up",
    stopIndex: 0,
    ...patch,
  };
}

function req(items: CargoItem[], patch: Partial<PackRequest> = {}): PackRequest {
  return {
    items,
    vehicle: kamaz,
    mode: "mixed",
    gaps: NO_GAP,
    stacking: true,
    maxLayers: 0,
    lifo: false,
    loadingSide: "rear",
    ...patch,
  };
}

/** XY-пересечение двух боксов (по Z не проверяем). */
function xyOverlap(
  a: { x: number; y: number; dx: number; dy: number },
  b: { x: number; y: number; dx: number; dy: number }
): boolean {
  return (
    a.x < b.x + b.dx - 0.5 &&
    a.x + a.dx > b.x + 0.5 &&
    a.y < b.y + b.dy - 0.5 &&
    a.y + a.dy > b.y + 0.5
  );
}

/** Родитель прямо под placement'ом (верхняя грань совпадает с его z). */
describe("stacking: ядро упаковки с учётом высот", () => {
  it("maxLayers=2: ограничивает число слоёв", () => {
    const items = [
      box({ id: "c", length: 800, width: 600, height: 800 }, 100),
    ];
    const limited = packLayout(req(items, { maxLayers: 2 }));
    const zs = [...new Set(limited.placements.map((p) => p.z))].sort((a, b) => a - b);
    expect(zs).toEqual([0, 800]);

    const free = packLayout(req(items, { maxLayers: 0 }));
    expect(free.placements.length).toBeGreaterThan(limited.placements.length);
    expect(new Set(free.placements.map((p) => p.z)).size).toBeGreaterThan(2);
  });

  it("опора: у каждого приподнятого груза поддержка ≥ 50% точек", () => {
    const items = [box({ id: "c", length: 800, width: 600, height: 800 }, 100)];
    const r = packLayout(req(items, { maxLayers: 0 }));
    const boxes = r.placements.map((p) => placementBox(items[0], p));
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (b.z <= 0.5) continue;
      const others = boxes.filter((_, j) => j !== i);
      expect(supportRatio(b, others), `опора для unit ${i}`).toBeGreaterThanOrEqual(0.5);
    }
  });

  it("нагрузка сверху: тяжёлый груз не ставится на слабую опору (maxTopLoad)", () => {
    const items = [
      box({ id: "weak", length: 1200, width: 800, height: 800, weight: 40, maxTopLoad: 50 }, 8),
      box({ id: "heavy", length: 800, width: 600, height: 800, weight: 700, maxTopLoad: 800 }, 40),
    ];
    const r = packLayout(req(items));
    // слабые и тяжёлые перемешаны на полу; тяжёлый НЕ должен лежать на слабом
    const weakBoxes = r.placements
      .filter((p) => p.itemId === "weak")
      .map((p) => placementBox(items[0], p));
    const heavyBoxes = r.placements
      .filter((p) => p.itemId === "heavy")
      .map((p) => placementBox(items[1], p));
    for (const hb of heavyBoxes) {
      if (hb.z <= 0.5) continue;
      const supportsOk = weakBoxes.every(
        (wb) => !(xyOverlap(wb, hb) && Math.abs(wb.z + wb.dz - hb.z) < 1)
      );
      expect(supportsOk, `heavy над weak на z=${hb.z}`).toBe(true);
    }
    // весь слабый груз размещён, тяжелых достаточно много, чтобы была наглядной проверка
    expect(r.placements.filter((p) => p.itemId === "weak")).toHaveLength(8);
    expect(heavyBoxes.length).toBeGreaterThanOrEqual(8);
  });

  it("совместимость: разные группы не штабелируются друг на друга", () => {
    const items = [
      box({ id: "fragile", length: 1200, width: 800, height: 800, group: "fragile", weight: 30, maxTopLoad: 500 }, 15),
      box({ id: "general", length: 1200, width: 800, height: 800, group: "general", weight: 30, maxTopLoad: 500 }, 20),
    ];
    const r = packLayout(req(items));
    const fragileBoxes = r.placements
      .filter((p) => p.itemId === "fragile")
      .map((p) => placementBox(items[0], p));
    const generalBoxes = r.placements
      .filter((p) => p.itemId === "general")
      .map((p) => placementBox(items[1], p));
    for (const gb of generalBoxes) {
      if (gb.z <= 0.5) continue;
      const onFragile = fragileBoxes.some(
        (fb) => xyOverlap(fb, gb) && Math.abs(fb.z + fb.dz - gb.z) < 1
      );
      expect(onFragile, "general на fragile").toBe(false);
    }
  });

  it("лежащий цилиндр: на образующую сверху класть нельзя (flatTop=false)", () => {
    const items = [
      {
        id: "cyl",
        name: "Бочка",
        shape: "cylinder" as const,
        length: 6000, // up-ориентация (высота = длина) не влезает → ляжет на образующую
        width: 0,
        height: 0,
        diameter: 800,
        weight: 200,
        quantity: 1,
        stackable: true,
        maxTopLoad: 500,
        group: "general",
        color: "#F97316",
        cylinderAxis: "up" as const,
        stopIndex: 0,
      },
      box({ id: "bx", length: 600, width: 600, height: 400 }, 8),
    ];
    const r = packLayout(req(items));
    const cyl = r.placements.find((p) => p.itemId === "cyl");
    expect(cyl).toBeDefined();
    expect(cyl?.axis).toBe("side");
    expect(r.placements.filter((p) => p.itemId === "bx").length).toBeGreaterThan(0);
    const cylDz = cyl!.axis === "side" ? 800 : 0;
    const onCyl = r.placements.filter(
      (p) => p.itemId === "bx" && Math.abs(p.z - (cyl!.z + cylDz)) < 1 && p.z > 0.5
    );
    expect(onCyl).toHaveLength(0);
  });

  it("вертикальный цилиндр: плоский торец — валидная опора", () => {
    const small = { ...kamaz, id: "v.small", innerLength: 1000, innerWidth: 1000, innerHeight: 2000, payload: 5000 };
    const items = [
      {
        id: "cyl",
        name: "Рулон",
        shape: "cylinder" as const,
        length: 1000,
        width: 0,
        height: 0,
        diameter: 600,
        weight: 100,
        quantity: 1,
        stackable: true,
        maxTopLoad: 500,
        group: "general",
        color: "#3EE0C5",
        cylinderAxis: "up" as const,
        stopIndex: 0,
      },
      box({ id: "bx", length: 600, width: 600, height: 400, weight: 60 }, 4),
    ];
    const r = packLayout({ ...req(items), vehicle: small });
    const cyl = r.placements.find((p) => p.itemId === "cyl");
    expect(cyl?.axis).toBe("up");
    // коробка впечатывается на торец цилиндра (пол + торец)
    const onCyl = r.placements.filter((p) => p.itemId === "bx" && Math.abs(p.z - 1000) < 1);
    expect(onCyl.length).toBeGreaterThan(0);
  });

  it("слои: уникальные z отсортированы, пол всегда на z=0", () => {
    const items = [box({ id: "c", length: 800, width: 600, height: 700 }, 60)];
    const r = packLayout(req(items));
    const zs = r.layers.map((l) => l.z);
    expect(zs[0]).toBe(0);
    expect([...zs].sort((a, b) => a - b)).toEqual(zs);
    expect(zs.length).toBe(r.layers.length);
  });
});