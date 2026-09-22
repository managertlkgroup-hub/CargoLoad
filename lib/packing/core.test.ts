import { describe, expect, it } from "vitest";

import { dimsFor } from "@/lib/geometry";
import { packLayout } from "@/lib/packing/core";
import type {
  CargoItem,
  Gaps,
  PackRequest,
  PackResult,
  Placement,
  VehicleSpec,
} from "@/types";

import { BUILTIN_VEHICLES } from "@/lib/presets/vehicles";

const kamaz = BUILTIN_VEHICLES.find((v) => v.id === "vehicle.kamaz")!;
const euro = BUILTIN_VEHICLES.find((v) => v.id === "vehicle.euro")!;

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

function req(patch: Partial<PackRequest>): PackRequest {
  return {
    items: [],
    vehicle: kamaz,
    mode: "along",
    gaps: NO_GAP,
    stacking: true,
    maxLayers: 0,
    lifo: true,
    loadingSide: "rear",
    ...patch,
  };
}

function itemGeom(item: CargoItem, p: Placement) {
  return dimsFor(item, p.yaw, p.axis);
}

/** Инварианты: внутри кузова, без пересечений (касание ок). */
function checkInvariants(r: PackResult, vehicle: VehicleSpec, gaps: Gaps) {
  const byId = new Map(r.placements.map((p) => [p.itemId, p]));
  expect(byId.size).toBeGreaterThanOrEqual(0);
  for (const p of r.placements) {
    const item = ITEMS.find((i) => i.id === p.itemId)!;
    const d = itemGeom(item, p);
    expect(p.x).toBeGreaterThanOrEqual(gaps.wall - 0.5);
    expect(p.y).toBeGreaterThanOrEqual(gaps.wall - 0.5);
    expect(p.z).toBeGreaterThanOrEqual(-0.5);
    expect(p.x + d.dx).toBeLessThanOrEqual(vehicle.innerLength - gaps.wall + 0.5);
    expect(p.y + d.dy).toBeLessThanOrEqual(vehicle.innerWidth - gaps.wall + 0.5);
    expect(p.z + d.dz).toBeLessThanOrEqual(vehicle.innerHeight + 0.5);
  }
  // парные пересечения
  const items = r.placements.map((p) => {
    const item = ITEMS.find((i) => i.id === p.itemId)!;
    const d = itemGeom(item, p);
    return { ...p, ...d };
  });
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      const overlap =
        a.x < b.x + b.dx - 0.5 &&
        a.x + a.dx > b.x + 0.5 &&
        a.y < b.y + b.dy - 0.5 &&
        a.y + a.dy > b.y + 0.5 &&
        a.z < b.z + b.dz - 0.5 &&
        a.z + a.dz > b.z + 0.5;
      expect(overlap, `пересечение ${i}×${j}`).toBe(false);
    }
  }
}

let ITEMS: CargoItem[] = [];

describe("packing core", () => {
  it("базовая раскладка: всё размещается, инварианты соблюдены", () => {
    ITEMS = [
      makeItem({ id: "a", quantity: 12 }),
      makeItem({ id: "b", length: 800, width: 600, height: 600, weight: 25, quantity: 6 }),
    ];
    const r = packLayout(req({ items: ITEMS, gaps: { wall: 40, rowWidth: 40, rowLength: 80 } }));
    expect(r.placements.length).toBe(18);
    expect(r.unplaced.length).toBe(0);
    checkInvariants(r, kamaz, { wall: 40, rowWidth: 40, rowLength: 80 });
  });

  it("зазоры между рядами соблюдаются минимум на rowLength/rowWidth", () => {
    ITEMS = [makeItem({ id: "a", quantity: 6 })];
    const gaps: Gaps = { wall: 100, rowWidth: 60, rowLength: 120 };
    const r = packLayout(req({ items: ITEMS, gaps }));
    checkInvariants(r, kamaz, gaps);
    // проверяем что по X соседние разнесены не меньше rowLength
    const sortedX = [...r.placements].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sortedX.length; i++) {
      const prev = sortedX[i - 1];
      const cur = sortedX[i];
      if (Math.abs(prev.y - cur.y) < 1 && Math.abs(prev.z - cur.z) < 1) {
        expect(cur.x - prev.x).toBeGreaterThanOrEqual(600 + gaps.rowLength - 0.5);
      }
    }
  });

  it("вес: при нехватке грузоподъёмности часть уходит в weight-limit", () => {
    ITEMS = [makeItem({ id: "a", weight: 900, quantity: 15 })]; // 13500 кг > 10000
    const r = packLayout(req({ items: ITEMS }));
    const placed = r.placements.length;
    expect(placed).toBeLessThan(15);
    const w = r.unplaced.find((u) => u.itemId === "a");
    expect(w?.reason).toBe("weight-limit");
    expect(placed * 900).toBeLessThanOrEqual(kamaz.payload);
  });

  it("штабелирование: слои появляются, когда пол заполнен", () => {
    ITEMS = [
      makeItem({ id: "stack", quantity: 70, height: 700, stackable: true, maxTopLoad: 800 }),
    ];
    const r = packLayout(req({ items: ITEMS }));
    const stackZ = r.placements.map((p) => p.z);
    expect(Math.max(...stackZ)).toBeGreaterThan(0); // кто-то наверху
    expect(r.layers.length).toBeGreaterThan(1);
    expect(r.placements.length).toBe(70);
    checkInvariants(r, kamaz, NO_GAP);
  });

  it("нештабелируемый груз несёт на себе только пол: сверху ничего не кладут", () => {
    ITEMS = [
      makeItem({ id: "nostack", quantity: 60, height: 800, stackable: false, maxTopLoad: 0 }),
      makeItem({ id: "stack", quantity: 10, height: 700, stackable: true, maxTopLoad: 800 }),
    ];
    const r = packLayout(req({ items: ITEMS }));
    // пол (60 мест) занят нештабелируемыми; остальным негде встать —
    // сверху на них класть нельзя
    expect(r.placements.filter((p) => p.itemId === "nostack")).toHaveLength(60);
    expect(r.placements.every((p) => p.z === 0)).toBe(true);
    expect(r.placements.filter((p) => p.itemId === "stack").length).toBeLessThan(10);
    checkInvariants(r, kamaz, NO_GAP);
  });

  it("stacking=false: всё на полу", () => {
    ITEMS = [makeItem({ id: "a", quantity: 40, height: 800 })];
    const r = packLayout(req({ items: ITEMS, stacking: false }));
    expect(r.placements.every((p) => p.z === 0)).toBe(true);
  });

  it("режим «Смешанный» не дублирует «Вдоль» (поворачивает груз при тесноте)", () => {
    const small: VehicleSpec = {
      ...kamaz,
      id: "v.small",
      innerLength: 3000,
      innerWidth: 1200,
      innerHeight: 2000,
      payload: 5000,
    };
    ITEMS = [makeItem({ id: "a", length: 1100, width: 700, height: 500, quantity: 3 })];
    const along = packLayout(req({ items: ITEMS, vehicle: small, mode: "along" }));
    const mixed = packLayout(req({ items: ITEMS, vehicle: small, mode: "mixed" }));
    const alongMaxZ = Math.max(...along.placements.map((p) => p.z));
    const mixedMaxZ = Math.max(...mixed.placements.map((p) => p.z));
    expect(alongMaxZ).toBeGreaterThan(0); // вдоль — третий уходит наверх
    expect(mixedMaxZ).toBe(0); // смешанный — поворачивает и все на полу
    const mixed90 = mixed.placements.filter((p) => p.yaw === 90).length;
    expect(mixed90).toBeGreaterThan(0);
  });

  it("мульти-стоп LIFO: первая точка выгрузки ближе всего к двери", () => {
    ITEMS = [
      makeItem({ id: "stop0", quantity: 1, stopIndex: 0 }),
      makeItem({ id: "stop1", quantity: 1, stopIndex: 1 }),
    ];
    const r = packLayout(req({ items: ITEMS, lifo: true, vehicle: euro }));
    const p0 = r.placements.find((p) => p.itemId === "stop0")!;
    const p1 = r.placements.find((p) => p.itemId === "stop1")!;
    // дверь задняя (x = L): stop0 разгружается первым → должен быть ближе к двери
    expect(p0.x).toBeGreaterThan(p1.x);
  });

  it("вертикальный цилиндр не «сплющивается»: высота = L, а не Ø", () => {
    ITEMS = [
      makeItem({
        id: "cyl",
        shape: "cylinder",
        length: 1000, // L
        diameter: 600,
        cylinderAxis: "up",
        quantity: 1,
      }),
    ];
    const r = packLayout(req({ items: ITEMS }));
    expect(r.placements).toHaveLength(1);
    const item = ITEMS[0];
    const d = dimsFor(item, r.placements[0].yaw, r.placements[0].axis);
    expect(d.dz).toBe(1000);
    expect(d.dx).toBe(600);
    expect(r.placements[0].axis).toBe("up");
  });

  it("негабарит больше кузова → too-big", () => {
    ITEMS = [makeItem({ id: "huge", shape: "oversize", length: 8000, width: 3000, height: 3000 })];
    const r = packLayout(req({ items: ITEMS }));
    expect(r.placements).toHaveLength(0);
    expect(r.unplaced[0]?.reason).toBe("too-big");
  });

  it("производительность: 100 грузов упаковываются < 1 сек", () => {
    ITEMS = Array.from({ length: 100 }, (_, i) =>
      makeItem({ id: `p${i}`, quantity: 1, weight: 40 + (i % 20) })
    );
    const t0 = performance.now();
    const r = packLayout(req({ items: ITEMS, vehicle: euro }));
    const ms = performance.now() - t0;
    expect(r.placements.length).toBeGreaterThanOrEqual(90);
    expect(ms).toBeLessThan(1000);
  });

  it("keep: ручная позиция сохраняется, новый груз укладывается вокруг", () => {
    const a = makeItem({ id: "a", quantity: 1 });
    const b = makeItem({ id: "b", quantity: 1, length: 900, width: 700, height: 700 });
    ITEMS = [a, b];
    const manual: Placement = {
      id: "a:0",
      itemId: "a",
      unitIndex: 0,
      x: 5000,
      y: 800,
      z: 0,
      yaw: 90,
      axis: "up",
      stopIndex: 0,
    };
    const r = packLayout(req({ items: ITEMS, keep: [manual] }));
    const kept = r.placements.find((p) => p.itemId === "a")!;
    expect(kept).toBeDefined();
    expect(kept.x).toBe(5000);
    expect(kept.y).toBe(800);
    expect(kept.yaw).toBe(90);
    expect(r.placements.some((p) => p.itemId === "b")).toBe(true);
    expect(r.unplaced).toHaveLength(0);
    checkInvariants(r, kamaz, NO_GAP);
  });

  it("keep: невалидная позиция (за габаритами) отбрасывается и переупаковывается", () => {
    const a = makeItem({ id: "a", quantity: 1 });
    ITEMS = [a];
    const bad: Placement = {
      id: "a:0",
      itemId: "a",
      unitIndex: 0,
      x: 99000,
      y: 0,
      z: 0,
      yaw: 0,
      axis: "up",
      stopIndex: 0,
    };
    const r = packLayout(req({ items: ITEMS, keep: [bad] }));
    expect(r.placements).toHaveLength(1);
    const p = r.placements[0];
    expect(p.x + dimsFor(a, p.yaw, p.axis).dx).toBeLessThanOrEqual(
      kamaz.innerLength + 0.5
    );
    expect(r.unplaced).toHaveLength(0);
  });

  it("keep: лишняя keep-единица (кол-во уменьшилось) не считается размещённой", () => {
    const a = makeItem({ id: "a", quantity: 2 });
    ITEMS = [a];
    const keeps: Placement[] = [
      { id: "a:0", itemId: "a", unitIndex: 0, x: 100, y: 100, z: 0, yaw: 0, axis: "up", stopIndex: 0 },
      { id: "a:3", itemId: "a", unitIndex: 3, x: 900, y: 100, z: 0, yaw: 0, axis: "up", stopIndex: 0 },
    ];
    const r = packLayout(req({ items: ITEMS, keep: keeps }));
    const ids = r.placements.map((p) => p.id).sort();
    expect(ids).toEqual(["a:0", "a:1"]);
    expect(r.unplaced).toHaveLength(0);
    checkInvariants(r, kamaz, NO_GAP);
  });

  it("keep: сохранённый груз — валидная опора, соседи не пересекаются", () => {
    const a = makeItem({ id: "a", quantity: 1, height: 600, stackable: true, maxTopLoad: 500 });
    const b = makeItem({ id: "b", quantity: 3, height: 600, stackable: true, maxTopLoad: 500 });
    ITEMS = [a, b];
    const manual: Placement = {
      id: "a:0",
      itemId: "a",
      unitIndex: 0,
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      axis: "up",
      stopIndex: 0,
    };
    const r = packLayout(req({ items: ITEMS, keep: [manual] }));
    expect(r.placements.filter((p) => p.itemId === "a")).toHaveLength(1);
    expect(r.placements.filter((p) => p.itemId === "b")).toHaveLength(3);
    expect(r.unplaced).toHaveLength(0);
    checkInvariants(r, kamaz, NO_GAP);
  });
});
