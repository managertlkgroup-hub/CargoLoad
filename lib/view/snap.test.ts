import { describe, expect, it } from "vitest";

import type { Box3 } from "@/lib/packing/collide";
import { snapPosition, type SnapContext } from "@/lib/view/snap";

const base: Omit<SnapContext, "enabled"> = {
  L: 4000,
  W: 2500,
  wall: 40,
  dx: 1200,
  dy: 800,
  others: [],
  grid: 100,
};

describe("снап в 2D (ТЗ B1): включается только < 50 мм у ребра/стены", () => {
  it("свободное пространство: груз свободно следует за мышью, без снапа", () => {
    const r = snapPosition(2050, 1300, { ...base, enabled: true });
    expect(r).toEqual({ x: 2050, y: 1300, align: null });
  });

  it("близко к левой стене (зазор 30 мм) — примагничивание, левый край", () => {
    const r = snapPosition(70, 1300, { ...base, enabled: true });
    expect(r.x).toBe(40);
    expect(r.align).toEqual({ axis: "x", side: "start" });
  });

  it("зазор ровно 50 мм — строгое «< 50»: снап не срабатывает", () => {
    const r = snapPosition(90, 1300, { ...base, enabled: true });
    expect(r.x).toBe(90);
    expect(r.align).toBeNull();
  });

  it("правая стена (зазор 10 мм у правого края) — правый край", () => {
    // правая кромка = rawX + 1200, стена = 3960
    const r = snapPosition(2770, 1300, { ...base, enabled: true });
    expect(r.x).toBe(2760);
    expect(r.align).toEqual({ axis: "x", side: "end" });
  });

  it("ребро соседа: груз вплотную слева от соседа", () => {
    const other: Box3 = { x: 2000, y: 0, z: 0, dx: 600, dy: 800, dz: 1000 };
    // правая кромка груза (rawX + 1200 = 2010) в 10 мм от левой кромки соседа
    const r = snapPosition(810, 1300, { ...base, others: [other], enabled: true });
    expect(r.x).toBe(800);
    expect(r.align).toEqual({ axis: "x", side: "end" });
  });

  it("сосед дальше 50 мм — к нему не тянет", () => {
    const other: Box3 = { x: 2000, y: 0, z: 0, dx: 600, dy: 800, dz: 1000 };
    // правая кромка груза в 100 мм от левой кромки соседа
    const r = snapPosition(880, 1300, { ...base, others: [other], enabled: true });
    expect(r.x).toBe(880);
    expect(r.align).toBeNull();
  });

  it("по каждой оси независимо: стена по X, свободно по Y", () => {
    const r = snapPosition(70, 1300, { ...base, enabled: true });
    expect(r.x).toBe(40);
    expect(r.y).toBe(1300);
    expect(r.align).toEqual({ axis: "x", side: "start" });
  });

  it("верхняя стена по Y — side start", () => {
    // grid 200: точка сетки (0) дальше порога, ближайший кандидат — стена 40
    const r = snapPosition(2050, 85, { ...base, grid: 200, enabled: true });
    expect(r.x).toBe(2050);
    expect(r.y).toBe(40);
    expect(r.align).toEqual({ axis: "y", side: "start" });
  });

  it("нижняя стена по Y — side end", () => {
    // нижняя кромка = rawY + 800, стена = 2460, зазор 30 мм
    const r = snapPosition(2050, 1690, { ...base, grid: 200, enabled: true });
    expect(r.x).toBe(2050);
    expect(r.y).toBe(1660);
    expect(r.align).toEqual({ axis: "y", side: "end" });
  });

  it("магнит выключен — только округление, без снапа", () => {
    const r = snapPosition(70, 90, { ...base, enabled: false });
    expect(r).toEqual({ x: 70, y: 90, align: null });
  });
});