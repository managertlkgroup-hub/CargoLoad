import { describe, expect, it } from "vitest";

import { recommendVehicleCount } from "@/lib/advanced/vehicle-selector";
import { BUILTIN_VEHICLES } from "@/lib/presets/vehicles";
import type { CargoItem } from "@/types";

const euro = BUILTIN_VEHICLES.find((v) => v.id === "vehicle.euro")!;

function pallet(qty: number): CargoItem {
  return {
    id: `pal${qty}`,
    name: "Европаллета",
    shape: "box",
    length: 1200,
    width: 800,
    height: 1400,
    diameter: 0,
    weight: 650,
    quantity: qty,
    stackable: true,
    maxTopLoad: 400,
    group: "general",
    color: "#10B981",
    cylinderAxis: "up",
    stopIndex: 0,
  };
}

describe("vehicle-selector: число машин", () => {
  it("60 европаллет → Еврофура (33 места) → 2 машины", () => {
    const r = recommendVehicleCount([pallet(60)], euro);
    expect(r.count).toBe(2);
    expect(r.byFloorArea).toBe(2);
    expect(r.totalWeightKg).toBe(39000);
  });

  it("20 европаллет → 1 машина", () => {
    const r = recommendVehicleCount([pallet(20)], euro);
    expect(r.count).toBe(1);
  });

  it("масса решает: перегруз одной машины → 2", () => {
    const items = [
      { ...pallet(1), id: "a", weight: 15000, diameter: 0 },
      { ...pallet(1), id: "b", weight: 15000, diameter: 0 },
    ];
    const r = recommendVehicleCount(items, euro);
    expect(r.byWeight).toBe(2);
    expect(r.count).toBe(2);
  });

  it("пустой груз → 1 машина", () => {
    expect(recommendVehicleCount([], euro).count).toBe(1);
  });

  it("зазоры от стен уменьшают полезную площадь", () => {
    const none = recommendVehicleCount([pallet(30)], euro);
    expect(none.byFloorArea).toBe(1);
    const walled = recommendVehicleCount([pallet(30)], euro, 100);
    expect(walled.usableFloorM2).toBeLessThan(none.usableFloorM2);
  });
});