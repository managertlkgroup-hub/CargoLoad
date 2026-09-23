import { describe, expect, it } from "vitest";

import {
  anyOverlap,
  insideContainer,
  overlaps,
  validateMove,
  type Box3,
} from "@/lib/packing/collide";

/**
 * ТЗ B1: касание разрешено, запрещено только пересечение по площади.
 * В 2D-виде ось Z (глубина) = y бокса, w = dx, h = dy.
 * Формула: isOverlap = x1 < x2 + w2 && x1 + w1 > x2 && z1 < z2 + h2 && z1 + h1 > z2
 */
const A: Box3 = { x: 0, y: 0, z: 0, dx: 1200, dy: 800, dz: 1750 };
const P: Box3 = { x: 1200, y: 0, z: 0, dx: 1200, dy: 800, dz: 1750 };

describe("коллизия (касание ок, пересечение запрещено)", () => {
  it("вплотную по X (x1 + w1 = x2) — не пересечение", () => {
    expect(overlaps(A, P)).toBe(false);
    expect(anyOverlap(A, [P])).toBe(false);
  });

  it("вплотную по Y — не пересечение", () => {
    const c: Box3 = { ...A, y: 800 };
    expect(overlaps(A, c)).toBe(false);
  });

  it("пересечение по X даже на 1 мм — пересечение", () => {
    const c: Box3 = { ...P, x: 1199 };
    expect(overlaps(A, c)).toBe(true);
    expect(anyOverlap(A, [c])).toBe(true);
  });

  it("пересечение по Y на 1 мм — пересечение", () => {
    const c: Box3 = { x: 100, y: 799, z: 0, dx: 1200, dy: 800, dz: 1750 };
    expect(overlaps(P, c)).toBe(true);
  });

  it("пересечение только по одной оси (смещение по обеим) — не пересечение", () => {
    const c: Box3 = { x: 1300, y: 100, z: 0, dx: 1200, dy: 800, dz: 1750 };
    expect(overlaps(A, c)).toBe(false);
  });

  it("касание углами — не пересечение", () => {
    const c: Box3 = { ...A, x: 1200, y: 800 };
    expect(overlaps(A, c)).toBe(false);
  });

  it("полное наложение — пересечение", () => {
    expect(overlaps(A, { ...A })).toBe(true);
  });

  it("разные слои по высоте — не пересечение", () => {
    const c: Box3 = { ...P, z: 1750 };
    expect(overlaps(A, c)).toBe(false);
  });

  it("validateMove: касание — ok, пересечение — overlap, за границей — bounds", () => {
    const container = { dx: 13600, dy: 2450, dz: 2700 };
    expect(validateMove(P, [A], container, false).ok).toBe(true);
    const overlapping: Box3 = { ...P, x: 1199 };
    expect(validateMove(overlapping, [A], container, false)).toMatchObject({
      ok: false,
      reason: "overlap",
    });
    const outside: Box3 = { x: -10, y: 0, z: 0, dx: 1200, dy: 800, dz: 1750 };
    expect(validateMove(outside, [], container, false)).toMatchObject({
      ok: false,
      reason: "bounds",
    });
  });

  it("insideContainer: касание стен допускается, выход за габарит — нет", () => {
    const container = { dx: 6200, dy: 2450, dz: 2500 };
    expect(insideContainer({ x: 0, y: 0, z: 0, dx: 1200, dy: 800, dz: 1750 }, container)).toBe(true);
    expect(
      insideContainer({ x: 5000, y: 0, z: 0, dx: 1200, dy: 800, dz: 1750 }, container)
    ).toBe(true);
    expect(
      insideContainer({ x: 5100, y: 0, z: 0, dx: 1200, dy: 800, dz: 1750 }, container)
    ).toBe(false);
  });
});