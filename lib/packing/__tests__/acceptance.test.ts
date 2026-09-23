import { describe, expect, it } from "vitest";

import { computeMetrics } from "@/lib/advanced/metrics";
import { dimsFor } from "@/lib/geometry";
import { packLayout } from "@/lib/packing/core";
import { overlaps, placementBox } from "@/lib/packing/collide";
import type { CargoItem, Gaps, PackMode, VehicleSpec } from "@/types";

/**
 * Финальная приёмка (ТЗ): 10 репрезентативных наборов грузов × 3 режима
 * раскладки (Вдоль/Поперёк/Смешанный) × 2 автомобиля. Проверяются инварианты:
 * размещено ≤ всего, позиции в границах кузова, вес ≤ грузоподъёмности,
 * габариты укладки ≤ кузова, отсутствие пересечений, метрики в [0,100],
 * каждый груз либо placed, либо unplaced.
 *
 * Только чистые функции ядра — 3D и DOM не запускаются (быстро, < 5 сек).
 */

const NO_GAP: Gaps = { wall: 0, rowWidth: 0, rowLength: 0 };
const MODES: PackMode[] = ["along", "cross", "mixed"];

/** КамАЗ-4308 по ТЗ: 6000×2400×2400, payload 7500 кг. */
const kamaz4308: VehicleSpec = {
  id: "kamaz-4308",
  name: "КамАЗ-4308",
  nameEn: "KamAZ-4308",
  builtin: false,
  innerLength: 6000,
  innerWidth: 2400,
  innerHeight: 2400,
  payload: 7500,
  tare: 0,
  axles: [],
  axleLayout: "rigid",
  loadingSides: ["rear"],
  defaultLoadingSide: "rear",
  bodyType: "test",
};

/** Еврофура по ТЗ: 13600×2450×2700, payload 20000 кг. */
const euro: VehicleSpec = {
  id: "euro",
  name: "Еврофура",
  nameEn: "Euro truck",
  builtin: false,
  innerLength: 13600,
  innerWidth: 2450,
  innerHeight: 2700,
  payload: 20000,
  tare: 0,
  axles: [],
  axleLayout: "tractor-semi",
  loadingSides: ["rear"],
  defaultLoadingSide: "rear",
  bodyType: "test",
};

interface BoxDef {
  l: number;
  w: number;
  h: number;
  weight: number;
  qty: number;
}

function boxItem(def: BoxDef & { id: string }): CargoItem {
  return {
    id: def.id,
    name: def.id,
    shape: "box",
    length: def.l,
    width: def.w,
    height: def.h,
    diameter: 0,
    weight: def.weight,
    quantity: def.qty,
    stackable: true,
    maxTopLoad: 10000,
    group: "general",
    color: "#8B5CF6",
    cylinderAxis: "up",
    stopIndex: 0,
  };
}

/** Наборы из ТЗ (размеры в мм, вес в кг). */
const SETS: { name: string; players: CargoItem[] }[] = [
  {
    name: "Набор 1 (≈3600 кг)",
    players: [
      boxItem({ id: "s1a", l: 1200, w: 840, h: 2070, weight: 300, qty: 2 }),
      boxItem({ id: "s1b", l: 1200, w: 1000, h: 1960, weight: 300, qty: 3 }),
      boxItem({ id: "s1c", l: 1360, w: 1060, h: 2070, weight: 300, qty: 2 }),
      boxItem({ id: "s1d", l: 1400, w: 870, h: 2160, weight: 300, qty: 5 }),
    ],
  },
  {
    name: "Набор 2 (≈3000 кг)",
    players: [
      boxItem({ id: "s2a", l: 1200, w: 857, h: 2090, weight: 300, qty: 4 }),
      boxItem({ id: "s2b", l: 1340, w: 1110, h: 2160, weight: 300, qty: 6 }),
    ],
  },
  {
    name: "Набор 3 (1000 кг)",
    players: [boxItem({ id: "s3a", l: 1700, w: 1200, h: 2070, weight: 500, qty: 2 })],
  },
  {
    name: "Набор 4 (2800 кг)",
    players: [boxItem({ id: "s4a", l: 697, w: 994, h: 2070, weight: 400, qty: 7 })],
  },
  {
    name: "Набор 5 (22 паллеты)",
    players: [boxItem({ id: "s5a", l: 1200, w: 800, h: 2070, weight: 500, qty: 22 })],
  },
  {
    name: "Набор 6 (негабарит, 3400 кг)",
    players: [
      {
        id: "s6a",
        name: "Барабан",
        shape: "cylinder",
        length: 15000,
        width: 0,
        height: 0,
        diameter: 2400,
        weight: 3400,
        quantity: 1,
        stackable: false,
        maxTopLoad: 0,
        group: "general",
        color: "#F97316",
        cylinderAxis: "up",
        stopIndex: 0,
      },
    ],
  },
  {
    name: "Набор 7 (1000 кг)",
    players: [
      boxItem({ id: "s7a", l: 1200, w: 800, h: 1500, weight: 250, qty: 2 }),
      boxItem({ id: "s7b", l: 1200, w: 1000, h: 1600, weight: 250, qty: 2 }),
    ],
  },
  {
    name: "Набор 8 (длинномеры, 500 кг)",
    players: [
      boxItem({ id: "s8a", l: 4400, w: 150, h: 150, weight: 250, qty: 1 }),
      boxItem({ id: "s8b", l: 2700, w: 150, h: 150, weight: 250, qty: 1 }),
    ],
  },
  {
    name: "Набор 9 (4820 кг)",
    players: [
      boxItem({ id: "s9a", l: 1200, w: 800, h: 2200, weight: 256, qty: 14 }),
      boxItem({ id: "s9b", l: 1200, w: 1200, h: 1800, weight: 206, qty: 6 }),
    ],
  },
  {
    name: "Набор 10 (2000 кг)",
    players: [
      boxItem({ id: "s10a", l: 1200, w: 800, h: 1900, weight: 286, qty: 6 }),
      boxItem({ id: "s10b", l: 1200, w: 800, h: 1900, weight: 290, qty: 1 }),
    ],
  },
];

/** Проверка инвариантов одного прогона. */
function verifyRun(items: CargoItem[], vehicle: VehicleSpec, mode: PackMode) {
  const r = packLayout({
    items,
    vehicle,
    mode,
    gaps: NO_GAP,
    stacking: false,
    maxLayers: 0,
    lifo: false,
    loadingSide: "rear",
  });

  const byId = new Map(items.map((i) => [i.id, i]));
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);

  // размещено ≤ всего
  expect(r.placements.length, `${mode}: placed ≤ total`).toBeLessThanOrEqual(totalUnits);

  // каждый placed — валидная единица существующего груза
  const placedByItem = new Map<string, number>();
  let placedWeight = 0;
  for (const p of r.placements) {
    const item = byId.get(p.itemId);
    expect(item, "placement → существующий груз").toBeDefined();
    expect(p.unitIndex).toBeLessThan(item!.quantity);
    placedByItem.set(p.itemId, (placedByItem.get(p.itemId) ?? 0) + 1);
    placedWeight += item!.weight;
  }

  // позиции внутри границ кузова (кроме негабарита — он не размещается)
  const boxes = r.placements.map((p) => placementBox(byId.get(p.itemId)!, p));
  for (let i = 0; i < r.placements.length; i++) {
    const item = byId.get(r.placements[i].itemId)!;
    const d = dimsFor(item, r.placements[i].yaw, r.placements[i].axis);
    expect(r.placements[i].x, "x ≥ 0").toBeGreaterThanOrEqual(-0.5);
    expect(r.placements[i].y, "y ≥ 0").toBeGreaterThanOrEqual(-0.5);
    expect(r.placements[i].z, "z ≥ 0").toBeGreaterThanOrEqual(-0.5);
    expect(r.placements[i].x + d.dx).toBeLessThanOrEqual(vehicle.innerLength + 0.5);
    expect(r.placements[i].y + d.dy).toBeLessThanOrEqual(vehicle.innerWidth + 0.5);
    expect(r.placements[i].z + d.dz).toBeLessThanOrEqual(vehicle.innerHeight + 0.5);
  }

  // суммарный вес placed ≤ грузоподъёмности
  expect(placedWeight).toBeLessThanOrEqual(vehicle.payload + 0.5);

  // габариты укладки ≤ кузова (X — длина, Y — ширина, Z — высота)
  const maxX = Math.max(0, ...boxes.map((b) => b.x + b.dx));
  const maxY = Math.max(0, ...boxes.map((b) => b.y + b.dy));
  const maxZ = Math.max(0, ...boxes.map((b) => b.z + b.dz));
  expect(maxX).toBeLessThanOrEqual(vehicle.innerLength + 0.5);
  expect(maxY).toBeLessThanOrEqual(vehicle.innerWidth + 0.5);
  expect(maxZ).toBeLessThanOrEqual(vehicle.innerHeight + 0.5);

  // нет пересечений (AABB, касание разрешено)
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      expect(overlaps(boxes[i], boxes[j]), `пересечение ${i}×${j}`).toBe(false);
    }
  }

  // placed ∪ unplaced = весь груз, третьего нет
  const unplacedQty = new Map<string, number>();
  for (const u of r.unplaced) {
    unplacedQty.set(u.itemId, (unplacedQty.get(u.itemId) ?? 0) + u.quantity);
  }
  for (const item of items) {
    const pl = placedByItem.get(item.id) ?? 0;
    const un = unplacedQty.get(item.id) ?? 0;
    expect(pl + un, `${item.id}: placed+unplaced = quantity`).toBe(item.quantity);
    expect(pl).toBeLessThanOrEqual(item.quantity);
  }

  // метрики в допустимых диапазонах
  const m = computeMetrics({
    items,
    placements: r.placements,
    unplaced: r.unplaced,
    vehicle,
    mode,
    gaps: NO_GAP,
  });
  expect(m.volumePct).toBeGreaterThanOrEqual(0);
  expect(m.volumePct).toBeLessThanOrEqual(100);
  expect(m.weightPct).toBeGreaterThanOrEqual(0);
  expect(m.weightPct).toBeLessThanOrEqual(100);

  // индивидуальный прогон должен быть очень быстрым
  expect(r.durationMs).toBeLessThan(1000);

  return r;
}

describe("приёмка: 10 наборов из ТЗ", () => {
  for (const set of SETS) {
    it(`${set.name}: 3 режима × 2 автомобиля, инварианты соблюдены`, () => {
      for (const mode of MODES) {
        verifyRun(set.players, kamaz4308, mode);
        const r = verifyRun(set.players, euro, mode);

        // набор 6 (негабарит) ни в один кузов не помещается
        if (set.name.includes("Набор 6")) {
          expect(r.placements).toHaveLength(0);
          const un = r.unplaced.find((u) => u.itemId === "s6a");
          expect(un?.quantity).toBe(1);
          expect(un?.reason).toBe("too-big");
        }
      }
    });
  }
});