import { describe, expect, it } from "vitest";

import { dimsFor, topViewShape } from "@/lib/geometry";
import { packLayout } from "@/lib/packing/core";
import type {
  CargoItem,
  Gaps,
  LoadingSide,
  PackMode,
  Placement,
  VehicleSpec,
} from "@/types";

/**
 * Группа A (по ТЗ): режимы раскладки «Вдоль/Поперёк/Смешанный»,
 * гнездование горизонтальных цилиндров, независимость от стороны
 * загрузки, отображение цилиндра в виде сверху, вертикальные цилиндры —
 * обычная прямоугольная укладка. Эталоны получены ручным расчётом из
 * геометрии при зазорах 0. Оси эталона: X — длина кузова, Z — ширина,
 * Y — высота (в тесте bbox возвращается как Д×Ш×В в координатах ядра).
 */

const NO_GAP: Gaps = { wall: 0, rowWidth: 0, rowLength: 0 };

/** Кузов-эталон для A1 (высота 2.8 м). */
const A1_BODY: VehicleSpec = {
  id: "ref.body",
  name: "Эталон",
  nameEn: "Reference",
  builtin: false,
  innerLength: 13600,
  innerWidth: 2450,
  innerHeight: 2800,
  payload: 40000,
  tare: 0,
  axles: [],
  axleLayout: "rigid",
  loadingSides: ["rear"],
  defaultLoadingSide: "rear",
  bodyType: "test",
};

/** Кузов-эталон для A2 (высота 2.7 м). */
const A2_BODY: VehicleSpec = { ...A1_BODY, innerHeight: 2700 };

function box(
  id: string,
  l: number,
  w: number,
  h: number,
  quantity: number,
  weight = 100
): CargoItem {
  return {
    id,
    name: id,
    shape: "box",
    length: l,
    width: w,
    height: h,
    diameter: 0,
    weight,
    quantity,
    stackable: true,
    maxTopLoad: 10000,
    group: "general",
    color: "#8B5CF6",
    cylinderAxis: "up",
    stopIndex: 0,
  };
}

function cyl(
  id: string,
  diameter: number,
  length: number,
  quantity: number,
  patch: Partial<CargoItem> = {}
): CargoItem {
  return {
    id,
    name: id,
    shape: "cylinder",
    length,
    width: 0,
    height: 0,
    diameter,
    weight: 100,
    quantity,
    stackable: true,
    maxTopLoad: 5000,
    group: "general",
    color: "#F97316",
    cylinderAxis: "side",
    stopIndex: 0,
    ...patch,
  };
}

function req(items: CargoItem[], mode: PackMode, vehicle: VehicleSpec) {
  return {
    items,
    vehicle,
    mode,
    gaps: NO_GAP,
    stacking: true,
    maxLayers: 0,
    lifo: false,
    loadingSide: "rear" as LoadingSide,
  };
}

/** Габариты укладки по placements (реальные, мм). */
function bbox(items: CargoItem[], r: { placements: Placement[] }) {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of r.placements) {
    const item = items.find((i) => i.id === p.itemId)!;
    const d = dimsFor(item, p.yaw, p.axis);
    x = Math.max(x, p.x + d.dx);
    y = Math.max(y, p.y + d.dy);
    z = Math.max(z, p.z + d.dz);
  }
  return { x, y, z };
}

function expectBBox(actual: { x: number; y: number; z: number }, exp: [number, number, number]) {
  const [ex, ey, ez] = exp;
  const tol = 8; // мм — округления координат
  expect(actual.x).toBeGreaterThan(ex * 1000 - tol);
  expect(actual.x).toBeLessThan(ex * 1000 + tol);
  expect(actual.y).toBeGreaterThan(ey * 1000 - tol);
  expect(actual.y).toBeLessThan(ey * 1000 + tol);
  expect(actual.z).toBeGreaterThan(ez * 1000 - tol);
  expect(actual.z).toBeLessThan(ez * 1000 + tol);
}

describe("Группа A1: режимы раскладки", () => {
  const SETS: Array<{
    name: string;
    items: CargoItem[];
    expected: Record<PackMode, [number, number, number]>;
  }> = [
    {
      name: "Набор А",
      items: [
        box("А1", 2800, 1120, 1750, 2),
        box("А2", 1220, 820, 1750, 1),
        box("А3", 1220, 800, 1750, 1),
        box("А4", 1200, 800, 1750, 1),
      ],
      expected: {
        along: [4.02, 2.42, 1.75],
        cross: [4.42, 2.44, 1.75],
        mixed: [4.02, 2.42, 1.75],
      },
    },
    {
      name: "Набор Б",
      items: [
        box("Б1", 1200, 800, 2090, 2),
        box("Б2", 1200, 940, 2090, 4),
        box("Б3", 1200, 800, 2090, 7),
      ],
      expected: {
        along: [6.0, 2.4, 2.09],
        cross: [5.88, 2.4, 2.09],
        mixed: [5.48, 2.4, 2.09],
      },
    },
    {
      name: "Набор В",
      items: [
        box("В1", 1220, 800, 1100, 1),
        box("В2", 1220, 800, 2065, 1),
        box("В5", 1200, 800, 2040, 1),
        box("В3", 1200, 960, 2040, 1),
        box("В4", 1200, 960, 2040, 1),
      ],
      expected: {
        along: [2.42, 2.4, 2.07],
        cross: [2.56, 2.42, 2.07],
        mixed: [2.18, 2.4, 2.07],
      },
    },
  ];

  for (const set of SETS) {
    it(`${set.name}: габариты укладки совпадают с эталоном по всем режимам`, () => {
      for (const mode of ["along", "cross", "mixed"] as PackMode[]) {
        const r = packLayout(req(set.items, mode, A1_BODY));
        expect(r.unplaced, `${mode}: всё размещено`).toHaveLength(0);
        expectBBox(bbox(set.items, r), set.expected[mode]);
      }
    });
  }

  it("along: все единицы вдоль (yaw=0)", () => {
    const set = SETS[0].items;
    const r = packLayout(req(set, "along", A1_BODY));
    expect(r.placements.every((p) => p.yaw === 0)).toBe(true);
  });

  it("cross: поворачивает только то, что влезает поперёк", () => {
    const set = SETS[0].items;
    const r = packLayout(req(set, "cross", A1_BODY));
    // А1 (2.8×1.12) поперёк не влезает (2.8 > 2.45) — вдоль; мелкие повёрнуты
    const a1 = r.placements.filter((p) => p.itemId === "А1");
    expect(a1).toHaveLength(2);
    expect(a1.every((p) => p.yaw === 0)).toBe(true);
    const small = r.placements.filter((p) => p.itemId !== "А1");
    expect(small).toHaveLength(3);
    expect(small.every((p) => p.yaw === 90)).toBe(true);
  });

  it("mixed: независимая ориентация по типу отличима от along и cross", () => {
    const set = SETS[1].items; // Набор Б: смешанный 5.48 короче вдольного 6.0
    const along = packLayout(req(set, "along", A1_BODY));
    const mixed = packLayout(req(set, "mixed", A1_BODY));
    expect(bbox(set, mixed).x).toBeLessThan(bbox(set, along).x - 400);
  });

  it("mixed набора В: В3/В4 выгоднее поперёк (X 2.18 < 2.42 вдоль)", () => {
    const set = SETS[2].items;
    const along = packLayout(req(set, "along", A1_BODY));
    const mixed = packLayout(req(set, "mixed", A1_BODY));
    expect(bbox(set, along).x).toBeGreaterThan(2400);
    expect(bbox(set, mixed).x).toBeLessThan(2200);
    expect(bbox(set, mixed).x).toBeLessThan(bbox(set, along).x - 200);
  });
});

describe("Группа A2: гнездование горизонтальных цилиндров", () => {
  const CASES: Array<{
    name: string;
    item: CargoItem;
    expected: [number, number, number];
    levels: number;
  }> = [
    { name: "бочки", item: cyl("бочки", 600, 900, 20), expected: [1.8, 2.4, 1.64], levels: 3 },
    { name: "газовые баллоны", item: cyl("газ", 300, 1500, 45), expected: [1.5, 2.4, 1.6], levels: 6 },
    { name: "бетонные трубы", item: cyl("трубы", 500, 2400, 11), expected: [2.4, 2.0, 1.37], levels: 3 },
    { name: "рулоны стали", item: cyl("рулоны", 1000, 3600, 5), expected: [3.6, 2.0, 2.73], levels: 3 },
    { name: "барабаны", item: cyl("барабаны", 1200, 1800, 6), expected: [3.6, 2.4, 2.24], levels: 2 },
    { name: "пластиковые ёмкости", item: cyl("пластик", 200, 3000, 50), expected: [3.0, 2.4, 0.89], levels: 5 },
    { name: "брёвна", item: cyl("брёвна", 450, 4000, 18), expected: [4.0, 2.25, 1.62], levels: 4 },
  ];

  for (const c of CASES) {
    it(`${c.name}: курган ${c.expected[0]}×${c.expected[1]}×${c.expected[2]} м, ${c.levels} слоёв`, () => {
      const r = packLayout(req([c.item], "along", A2_BODY));
      expect(r.unplaced).toHaveLength(0);
      expect(r.placements).toHaveLength(c.item.quantity);
      expect(r.placements.every((p) => p.axis === "side")).toBe(true);
      expectBBox(bbox([c.item], r), c.expected);
      const zs = new Set(r.placements.map((p) => p.z));
      expect(zs.size).toBe(c.levels);
    });
  }

  it("рулоны: 2 в основании, 1 в среднем ряду, 2 в вершине (смещение на d/2)", () => {
    // n = floor(2450/1000) = 2 ряда в основании; курган k=3: 2/1/2 по слоям
    const item = cyl("рулоны", 1000, 3600, 5);
    const r = packLayout(req([item], "along", A2_BODY));
    const byZ = new Map<number, Placement[]>();
    for (const p of r.placements) {
      const arr = byZ.get(p.z) ?? [];
      arr.push(p);
      byZ.set(p.z, arr);
    }
    expect(byZ.size).toBe(3);
    expect(byZ.get(0)!.length).toBe(2);
    expect(byZ.get(Math.round(1000 * 0.866))!.length).toBe(1);
    expect(byZ.get(Math.round(2 * 1000 * 0.866))!.length).toBe(2);
    const mid = byZ.get(Math.round(1000 * 0.866))![0];
    expect(mid.y).toBe(500); // смещение среднего ряда на d/2 в паз основания
  });

  it("высота кузова не позволяет вложить курсан — укладка обычная, остаток no-space", () => {
    // рулоны d=1000, L=3600, qty=5 в KAMAZ (6200×2450×2500): курган 3×2 не лезет
    // по высоте (k=3 → 2732 > 2600), k=2 вмещает 3 → гнездование отключается,
    // generic кладёт 2 и не может положить остальные 3 (бесконечная X-колонна).
    const item = cyl("рулоны", 1000, 3600, 5);
    const kamaz: VehicleSpec = { ...A1_BODY, innerLength: 6200, innerWidth: 2450, innerHeight: 2500, id: "kamaz" };
    const r = packLayout(req([item], "along", kamaz));
    expect(r.placements).toHaveLength(2);
    expect(r.placements.every((p) => p.axis === "side")).toBe(true);
    const un = r.unplaced.find((u) => u.itemId === item.id);
    expect(un?.quantity).toBe(3);
    expect(un?.reason).toBe("no-space");
  });
});

describe("Группа A3: сторона загрузки не влияет на раскладку", () => {
  const items = [
    box("А1", 2800, 1120, 1750, 2),
    box("А2", 1220, 820, 1750, 1),
    box("А3", 1220, 800, 1750, 1),
    box("А4", 1200, 800, 1750, 1),
  ];
  const expected: Record<PackMode, [number, number, number]> = {
    along: [4.02, 2.42, 1.75],
    cross: [4.42, 2.44, 1.75],
    mixed: [4.02, 2.42, 1.75],
  };

  for (const mode of ["along", "cross", "mixed"] as PackMode[]) {
    it(`${mode}: placements одинаковые для rear/right/left`, () => {
      const runs = (["rear", "right", "left"] as LoadingSide[]).map((side) =>
        packLayout({ ...req(items, mode, A1_BODY), loadingSide: side })
      );
      const norm = (r: { placements: Placement[] }) =>
        r.placements
          .map((p) => [p.itemId, p.x, p.y, p.z, p.yaw, p.axis] as const)
          .sort((a, b) => String(a[0]).localeCompare(String(b[0])) || a[1] - b[1]);
      expect(norm(runs[1])).toEqual(norm(runs[0]));
      expect(norm(runs[2])).toEqual(norm(runs[0]));
      for (const r of runs) {
        expect(r.unplaced).toHaveLength(0);
        expectBBox(bbox(items, r), expected[mode]);
      }
    });
  }
});

describe("Группа A4: вид сверху", () => {
  it("вертикальный цилиндр — круг, лёжа — прямоугольник, коробка — прямоугольник", () => {
    const vcyl = cyl("v", 600, 900, 1);
    expect(topViewShape(vcyl, "up")).toBe("circle");
    expect(topViewShape(vcyl, "side")).toBe("rect");
    expect(topViewShape(box("b", 1000, 500, 400, 1), "up")).toBe("rect");
  });
});

describe("Группа A5: вертикальные цилиндры без гнездования", () => {
  it("up-цилиндры стоят на торцах в прямоугольной решётке (все на полу)", () => {
    const item = cyl("v", 600, 900, 12, { cylinderAxis: "up" });
    const kamaz: VehicleSpec = { ...A1_BODY, innerLength: 6200, innerWidth: 2450, innerHeight: 2500, id: "kamaz" };
    const r = packLayout(req([item], "along", kamaz));
    expect(r.unplaced).toHaveLength(0);
    expect(r.placements).toHaveLength(12);
    expect(r.placements.every((p) => p.axis === "up")).toBe(true);
    expect(r.placements.every((p) => p.z === 0)).toBe(true);
    // ровная сетка: x и y кратны Ø — без сдвигов d/2 от гнездования стоящих
    expect(r.placements.every((p) => p.y % 600 === 0)).toBe(true);
    expect(r.placements.every((p) => p.x % 600 === 0)).toBe(true);
  });

  it("смешанный: цилиндр выбирает экономичную ориентацию (лежа плотнее)", () => {
    // «стоит/лежит» — предпочтение в режиме вдоль; в смешанном выбор оптимизирует
    // объём. 6 бочек d=600×900 в KAMAZ лежа занимают меньше объёма, чем стоя.
    const item = cyl("v2", 600, 900, 6, { cylinderAxis: "up" });
    const kamaz: VehicleSpec = { ...A1_BODY, innerLength: 6200, innerWidth: 2450, innerHeight: 2500, id: "kamaz" };
    const along = packLayout(req([item], "along", kamaz));
    expect(along.unplaced).toHaveLength(0);
    expect(along.placements.every((p) => p.axis === "up")).toBe(true);
    const mixed = packLayout(req([item], "mixed", kamaz));
    expect(mixed.unplaced).toHaveLength(0);
    const a = bbox([item], along);
    const m = bbox([item], mixed);
    expect((m.x * m.y * m.z) / 1e6).toBeLessThanOrEqual((a.x * a.y * a.z) / 1e6);
  });
});