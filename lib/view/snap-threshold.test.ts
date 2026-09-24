import { describe, expect, it } from "vitest";

import type { Box3 } from "@/lib/packing/collide";
import { snapPosition, type SnapContext } from "@/lib/view/snap";

/** Кузов «Еврофуры»: 13600×2450, зазор от стен 40, сетка 50. */
const ctx = (patch: Partial<SnapContext> = {}): SnapContext => ({
  L: 13600,
  W: 2450,
  wall: 40,
  dx: 1000,
  dy: 800,
  others: [],
  grid: 50,
  enabled: true,
  threshold: 50,
  ...patch,
});

describe("порог магнита (snapThreshold)", () => {
  it("порог 0 — примагничивание выключено, только округление", () => {
    expect(snapPosition(45, 1000, ctx({ threshold: 0 }))).toEqual({
      x: 45,
      y: 1000,
      align: null,
    });
  });

  it("порог 25 — на 30 мм от стены не срабатывает", () => {
    expect(snapPosition(70, 1000, ctx({ threshold: 25 }))).toEqual({
      x: 70,
      y: 1000,
      align: null,
    });
  });

  it("порог 50 — те же 30 мм притягивает (к сетке)", () => {
    const r = snapPosition(70, 1000, ctx({ threshold: 50 }));
    expect(r.x).toBe(50);
    expect(r.y).toBe(1000);
  });

  it("порог 100 цепляет на 70 мм, порог 50 — нет", () => {
    expect(snapPosition(110, 1000, ctx({ threshold: 50 })).x).toBe(110);
    expect(snapPosition(110, 1000, ctx({ threshold: 100 })).x).toBe(100);
  });

  it("у стены — притяжение к стенке с подсветкой align", () => {
    expect(snapPosition(45, 1000, ctx({ threshold: 50 }))).toEqual({
      x: 40,
      y: 1000,
      align: { axis: "x", side: "start" },
    });
  });

  it("enabled: false — снап выключен при любом пороге", () => {
    expect(snapPosition(45, 1000, ctx({ threshold: 100, enabled: false }))).toEqual({
      x: 45,
      y: 1000,
      align: null,
    });
  });

  it("примагничивание к ребру соседа — только в пределах порога", () => {
    const others: Box3[] = [{ x: 2000, y: 100, z: 0, dx: 1000, dy: 800, dz: 800 }];
    // 40 мм до правого ребра соседа: порог 25 — мимо, порог 50 — снап
    expect(snapPosition(3040, 1000, ctx({ others, threshold: 25 }))).toEqual({
      x: 3040,
      y: 1000,
      align: null,
    });
    const r = snapPosition(3040, 1000, ctx({ others, threshold: 50 }));
    expect(r.x).toBe(3050);
    expect(r.y).toBe(1000);
  });
});
