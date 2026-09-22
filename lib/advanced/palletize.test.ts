import { describe, expect, it } from "vitest";

import {
  PALLET_PRESETS,
  findPallet,
  palletizeBoxes,
} from "@/lib/advanced/palletize";

const EUR = PALLET_PRESETS[0];

describe("palletize: коробки 400×300×200 на европаллете", () => {
  it("с поворотом в слое: 8 в слое, 6 слоёв, 48 на паллету", () => {
    const r = palletizeBoxes({
      boxLength: 400,
      boxWidth: 300,
      boxHeight: 200,
      boxWeight: 20,
      quantity: 100,
      preset: EUR,
    });
    expect(r.fullLayers).toBe(6);
    expect(r.boxesPerPallet).toBe(48);
    expect(r.palletCount).toBe(3);
    expect(r.unitHeight).toBe(1200);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].quantity).toBe(3);
    expect(r.items[0].weight).toBe(960);
    expect(r.items[0].length).toBe(1200);
    expect(r.items[0].width).toBe(800);
  });

  it("без поворота: 6 в слое, 42 на паллету", () => {
    const r = palletizeBoxes({
      boxLength: 400,
      boxWidth: 300,
      boxHeight: 200,
      boxWeight: 20,
      quantity: 100,
      preset: EUR,
      allowRotate: false,
    });
    expect(r.boxesPerPallet).toBe(42);
    expect(r.palletCount).toBe(3);
  });

  it("ровное деление: 96 коробок → ровно 2 паллеты", () => {
    const r = palletizeBoxes({
      boxLength: 400,
      boxWidth: 300,
      boxHeight: 200,
      boxWeight: 20,
      quantity: 96,
      preset: EUR,
    });
    expect(r.palletCount).toBe(2);
  });

  it("коробка больше паллеты → на каждой паллете одна", () => {
    const r = palletizeBoxes({
      boxLength: 1500,
      boxWidth: 900,
      boxHeight: 1500,
      boxWeight: 100,
      quantity: 4,
      preset: EUR,
    });
    expect(r.boxesPerPallet).toBe(1);
    expect(r.palletCount).toBe(4);
    expect(r.fullLayers).toBe(1);
  });

  it("findPallet: известные и fallback", () => {
    expect(findPallet("pallet.eur").name).toBe("Европаллета");
    expect(findPallet("pallet.iso").width).toBe(1000);
    expect(findPallet("nope").id).toBe("pallet.eur");
  });
});