import { describe, expect, it } from "vitest";

import {
  buildMetricsOverlay,
  drawLayout,
  layoutRects,
  visibleForLayer,
  type DrawLayoutOpts,
} from "@/lib/export/png";
import type { CargoItem, Placement } from "@/types";

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

const opts: DrawLayoutOpts = {
  size: { w: 800, h: 600 },
  truck: { innerLength: 1000, innerWidth: 1000 },
  items: [item],
  placements,
  layers: [
    { index: 0, z: 0 },
    { index: 1, z: 500 },
  ],
  activeLayer: -1,
  loadingSide: "rear",
  locale: "ru",
  lengthUnit: "mm",
  legendTitle: "Легенда",
};

/** Записывающий стиб контекста канваса (vitest без DOM). */
function makeStubCtx() {
  const records: Array<[string, ...unknown[]]> = [];
  const ctx = new Proxy(
    { measureText: () => ({ width: 100 }) },
    {
      get(target, prop) {
        if (prop === "measureText") return target.measureText;
        if (typeof prop === "string") {
          return (...args: unknown[]) => {
            records.push([prop, ...args]);
          };
        }
        return undefined;
      },
      set(target, prop, value) {
        (target as Record<string, unknown>)[String(prop)] = value;
        return true;
      },
    }
  );
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    records,
    calls: (name: string) => records.filter((r) => r[0] === name),
  };
}

describe("png.visibleForLayer", () => {
  it("активный слой -1 показывает все размещения", () => {
    expect(visibleForLayer(placements, opts.layers, -1)).toHaveLength(2);
  });

  it("фильтрует по z выбранного слоя", () => {
    expect(visibleForLayer(placements, opts.layers, 0)).toHaveLength(1);
    expect(visibleForLayer(placements, opts.layers, 0)[0].z).toBe(0);
    expect(visibleForLayer(placements, opts.layers, 1)[0].z).toBe(500);
  });

  it("неизвестный слой показывает все размещения", () => {
    expect(visibleForLayer(placements, opts.layers, 99)).toHaveLength(2);
  });
});

describe("png.layoutRects", () => {
  it("кузов центрируется и влезает в канвас с полями", () => {
    const r = layoutRects(opts);
    // scale = min(672/1000, 472/1000) = 0.472
    expect(r.scale).toBeCloseTo(0.472, 3);
    expect(r.body.w).toBeCloseTo(472, 1);
    expect(r.body.y).toBeGreaterThan(0);
    expect(r.body.x + r.body.w).toBeLessThan(opts.size.w);
  });

  it("грузы проецируются 1:1 по размещениям с цветом и подписью", () => {
    const r = layoutRects(opts);
    expect(r.cargo).toHaveLength(2);
    for (const c of r.cargo) {
      expect(c.color).toBe(item.color);
      expect(c.label).toBe("Ящик");
      expect(c.w).toBeCloseTo(236, 1);
    }
  });

  it("легенда ограничена 8 строками и сортирует по количеству", () => {
    const r = layoutRects(opts);
    expect(r.legend.rows[0]).toEqual({ color: item.color, name: "Ящик", qty: 2 });
  });

  it("активный слой сужает и грузы, и легенду", () => {
    const r = layoutRects({ ...opts, activeLayer: 0 });
    expect(r.cargo).toHaveLength(1);
    expect(r.legend.rows[0].qty).toBe(1);
  });
});

describe("png.drawLayout", () => {
  it("канвас не пустой: фон, кузов и грузы закрашиваются, есть подписи", () => {
    const { ctx, records, calls } = makeStubCtx();
    const rects = drawLayout(ctx, opts);

    // фон 0,0,w,h
    expect(
      calls("fillRect").some(([, x, y, w, h]) => x === 0 && y === 0 && w === 800 && h === 600)
    ).toBe(true);
    // кузов
    const bodyFill = calls("fillRect").find(
      ([, x, y, w, h]) =>
        typeof x === "number" &&
        typeof y === "number" &&
        typeof w === "number" &&
        typeof h === "number" &&
        Math.abs(x - rects.body.x) < 0.01 &&
        Math.abs(y - rects.body.y) < 0.01 &&
        Math.abs(w - rects.body.w) < 0.01 &&
        Math.abs(h - rects.body.h) < 0.01
    );
    expect(bodyFill).toBeTruthy();
    // обводка кузова
    expect(calls("strokeRect").length).toBeGreaterThanOrEqual(1);
    // грузы (2 размещения) рисуются скруглёнными прямоугольниками
    const cargoRR = calls("roundRect").filter(
      ([, , , w]) => typeof w === "number" && Math.abs(w - 236) < 0.5
    );
    expect(cargoRR.length).toBe(2);
    // пути грузов заливались краской
    expect(calls("fill").length).toBeGreaterThanOrEqual(3);
    // подписи грузов + размеры + легенда
    expect(records.filter(([name]) => name === "fillText").length).toBeGreaterThanOrEqual(4);
  });
});

describe("png.buildMetricsOverlay", () => {
  it("строит 6 строк с процентами и единицами", () => {
    const metrics = {
      volumeUsedM3: 0.25,
      volumeTotalM3: 1,
      volumeFreeM3: 0.75,
      volumePct: 25,
      weightUsedKg: 200,
      weightFreeKg: 800,
      weightCapacityKg: 1000,
      weightPct: 20,
      placedCount: 1,
      totalCount: 2,
      bboxNoGaps: { length: 500, width: 500, height: 1000 },
      bboxWithGaps: { length: 540, width: 530, height: 1000 },
      currentLayers: 2,
      canStack: true,
      maxLayers: 2,
      floorAreaM2: 0.5,
      ldm: 0.21,
      cog: { x: 250, y: 250, z: 500, longitudinalPct: -25, lateralPct: 0, level: "crit" as const },
      unplaced: [],
      axles: [] as unknown[],
      axlesAvailable: false,
    } as never;

    const lines = buildMetricsOverlay(metrics, "ru", { length: "mm", weight: "kg" }, {
      volume: "Объём",
      weight: "Вес",
      placed: "Размещено",
      bbox: "Габариты",
      layers: "Слои",
      ldm: "LDM",
      cog: "ЦТ",
    } as never);
    expect(lines).toHaveLength(6);
    expect(lines[0]).toContain("Объём:");
    expect(lines[0]).toContain("м³");
    expect(lines[0]).toContain("25 %");
    expect(lines[1]).toContain("200 кг");
    expect(lines[2]).toContain("1 / 2");
    expect(lines[5]).toContain("-25");
  });
});