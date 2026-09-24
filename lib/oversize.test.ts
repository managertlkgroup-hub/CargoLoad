import { describe, expect, it } from "vitest";

import type { Geom } from "@/lib/geometry";
import { exceedsVehicleDims, isOversizeItem } from "@/lib/oversize";

const box = (length: number, width: number, height: number): Geom => ({
  shape: "box",
  length,
  width,
  height,
  diameter: 0,
});

/** Внутренние габариты «Еврофуры». */
const L = 13600;
const W = 2450;
const H = 2700;

describe("exceedsVehicleDims — физика, а не флаг", () => {
  it("груз длиннее кузова → превышение", () => {
    expect(exceedsVehicleDims(box(15000, 2400, 2600), L, W, H)).toBe(true);
  });

  it("груз шире кузова → превышение", () => {
    expect(exceedsVehicleDims(box(3000, 3000, 2600), L, W, H)).toBe(true);
  });

  it("груз выше кузова → превышение", () => {
    expect(exceedsVehicleDims(box(3000, 2400, 3000), L, W, H)).toBe(true);
  });

  it("груз входит во все три габарита → без превышения", () => {
    expect(exceedsVehicleDims(box(5000, 2400, 2600), L, W, H)).toBe(false);
  });

  it("ровно в габарит кузова → не превышение (строгое >)", () => {
    expect(exceedsVehicleDims(box(L, W, H), L, W, H)).toBe(false);
  });
});

describe("isOversizeItem — только юзер-флаг или legacy-форма", () => {
  it("флаг isOversize=true → негабарит", () => {
    expect(isOversizeItem({ shape: "box", isOversize: true })).toBe(true);
  });

  it("нет авто-детекта: физически больше кузова, но флаг не выставлен → не негабарит", () => {
    const big = box(15000, 3000, 3000);
    expect(exceedsVehicleDims(big, L, W, H)).toBe(true);
    expect(isOversizeItem(big)).toBe(false);
  });

  it("legacy-форма «oversize» из старых раскладок → негабарит", () => {
    expect(isOversizeItem({ shape: "oversize" })).toBe(true);
  });

  it("обычный груз без флага → не негабарит", () => {
    expect(isOversizeItem(box(5000, 2400, 2600))).toBe(false);
  });
});
