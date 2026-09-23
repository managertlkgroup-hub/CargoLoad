import { describe, expect, it } from "vitest";

import { computeViewZones, dimLabels, estTextWidth } from "@/lib/view/zones";

describe("2D view zones", () => {
  it("легенда внутри вьюпорта (низ-право)", () => {
    for (const [w, h] of [
      [400, 300],
      [800, 600],
      [1280, 720],
      [1920, 480],
      [480, 1080],
    ] as const) {
      const z = computeViewZones(w, h, 8);
      expect(z.legend.x).toBeGreaterThanOrEqual(0);
      expect(z.legend.y).toBeGreaterThanOrEqual(0);
      expect(z.legend.x + z.legend.w).toBeLessThanOrEqual(w);
      expect(z.legend.y + z.legend.h).toBeLessThanOrEqual(h);
    }
  });

  it("размер легенды растёт от числа строк (ограничен6)", () => {
    const few = computeViewZones(800, 600, 1);
    const many = computeViewZones(800, 600, 20);
    expect(many.legend.h).toBeGreaterThan(few.legend.h);
    expect(many.legend.h).toBeLessThanOrEqual(26 + 6 * 20 + 10);
  });
});

describe("подписи размеров привязаны к кузову (ТЗ B2)", () => {
  it("длина — по центру над верхней кромкой, ширина — слева по вертикали", () => {
    const d = dimLabels({ ox: 200, oy: 150, w: 400, h: 300 }, "13.6 м", "2.5 м");
    expect(d.len.x).toBe(400);
    expect(d.len.y).toBe(150 - d.offset);
    expect(d.len.fontSize).toBe(12);
    expect(d.wid.x).toBe(200 - d.offset);
    expect(d.wid.y).toBe(300);
    expect(d.wid.fontSize).toBe(12);
  });

  it("отступ 8–12 px не зависит от положения/размера кузова", () => {
    for (const [ox, oy, w, h] of [
      [200, 150, 400, 300],
      [60, 40, 120, 90],
      [444, 190, 900, 500],
    ] as const) {
      const d = dimLabels({ ox, oy, w, h }, "13.6 м", "2.5 м");
      expect(d.offset).toBeGreaterThanOrEqual(8);
      expect(d.offset).toBeLessThanOrEqual(12);
      expect(d.len.y).toBe(oy - d.offset);
      expect(d.wid.x).toBe(ox - d.offset);
      // подпись не отрывается от кузова при любом масштабе
      expect(d.len.x).toBe(ox + w / 2);
      expect(d.wid.y).toBe(oy + h / 2);
    }
  });

  it("если текст шире кузова — шрифт 11px, но подпись остаётся на кузове", () => {
    const d = dimLabels({ ox: 100, oy: 60, w: 20, h: 20 }, "13.6 м", "2.5 м");
    expect(d.len.fontSize).toBe(11);
    expect(d.wid.fontSize).toBe(11);
    expect(d.len.y).toBe(60 - d.offset);
    expect(d.wid.x).toBe(100 - d.offset);
  });

  it("нормальный шрифт 12px при достаточной ширине кузова", () => {
    const d = dimLabels({ ox: 100, oy: 60, w: 200, h: 200 }, "13.6 м", "2.5 м");
    expect(d.len.fontSize).toBe(12);
    expect(d.wid.fontSize).toBe(12);
  });

  it("estTextWidth пропорциональна длине текста", () => {
    expect(estTextWidth("abc", 10)).toBeCloseTo(10 * 3 * 0.62);
  });
});