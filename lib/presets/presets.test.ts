import { describe, expect, it } from "vitest";

import {
  findVehicle,
  resolveCargoPresets,
  resolveVehicles,
  type PresetsSnapshot,
} from "@/lib/presets/select";
import { BUILTIN_CARGO_PRESETS } from "@/lib/presets/cargo";
import { BUILTIN_VEHICLES } from "@/lib/presets/vehicles";

const EMPTY: PresetsSnapshot = {
  cargoOverrides: {},
  customCargo: [],
  vehicleOverrides: {},
  customVehicles: [],
};

const byId = <T extends { id: string }>(list: T[]) => (id: string): T =>
  list.find((x) => x.id === id)!;

describe("presets: встроенные грузы и автомобили", () => {
  it("встроенные авто: ГАЗель, Бычок, ЗИЛ, КамАЗ, Еврофура, Jumbo", () => {
    const veh = byId(BUILTIN_VEHICLES);
    ["vehicle.gazel", "vehicle.bychok", "vehicle.zil", "vehicle.kamaz", "vehicle.euro", "vehicle.jumbo"].forEach(
      (id) => expect(veh(id).builtin).toBe(true)
    );
    expect(veh("vehicle.gazel").innerLength).toBe(3100);
    expect(veh("vehicle.gazel").payload).toBe(1500);
    expect(veh("vehicle.kamaz").innerLength).toBe(6200);
    expect(veh("vehicle.kamaz").innerWidth).toBe(2450);
    expect(veh("vehicle.kamaz").payload).toBe(10000);
    expect(veh("vehicle.euro").innerLength).toBe(13600);
    expect(veh("vehicle.euro").payload).toBe(20000);
    expect(veh("vehicle.euro").axleLayout).toBe("tractor-semi");
    expect(veh("vehicle.jumbo").innerHeight).toBe(3000);
    expect(veh("vehicle.jumbo").payload).toBe(24000);
  });

  it("встроенные авто: ключи уникальны, оси сбалансированы, загрузка валидна", () => {
    const ids = new Set(BUILTIN_VEHICLES.map((v) => v.id));
    expect(ids.size).toBe(BUILTIN_VEHICLES.length);
    for (const v of BUILTIN_VEHICLES) {
      expect(v.innerLength).toBeGreaterThan(0);
      expect(v.innerWidth).toBeGreaterThan(0);
      const share = v.axles.reduce((s, a) => s + a.tareShare, 0);
      expect(Math.abs(share - 1)).toBeLessThanOrEqual(0.02);
      expect(v.loadingSides).toContain(v.defaultLoadingSide);
    }
  });

  it("встроенные грузы: уникальные id, цвета в формате #rrggbb", () => {
    const ids = new Set(BUILTIN_CARGO_PRESETS.map((p) => p.id));
    expect(ids.size).toBe(BUILTIN_CARGO_PRESETS.length);
    for (const p of BUILTIN_CARGO_PRESETS) {
      expect(p.builtin).toBe(true);
      expect(/^#[0-9a-fA-F]{6}$/.test(p.data.color)).toBe(true);
      expect(p.data.quantity).toBeGreaterThanOrEqual(1);
      expect(p.data.weight).toBeGreaterThan(0);
    }
  });
});

describe("presets: оверрайды, сброс к дефолту, пользовательские", () => {
  it("resolveVehicles: оверрайд встроенного + пользовательский в конце списка", () => {
    const gazel = BUILTIN_VEHICLES.find((v) => v.id === "vehicle.gazel")!;
    const custom = { ...gazel, id: "vehicle.mine", name: "Мой", builtin: false, payload: 999 };
    const state: PresetsSnapshot = {
      ...EMPTY,
      vehicleOverrides: {
        "vehicle.gazel": { ...gazel, payload: 2000 },
      },
      customVehicles: [custom],
    };
    const all = resolveVehicles(state);
    expect(all.find((v) => v.id === "vehicle.gazel")!.payload).toBe(2000);
    expect(all[all.length - 1].id).toBe("vehicle.mine");
    expect(all.length).toBe(BUILTIN_VEHICLES.length + 1);
  });

  it("сброс к дефолту: удаление оверрайда возвращает встроенное значение", () => {
    const gazel = BUILTIN_VEHICLES.find((v) => v.id === "vehicle.gazel")!;
    const state: PresetsSnapshot = {
      ...EMPTY,
      vehicleOverrides: { "vehicle.gazel": { ...gazel, payload: 2000 } },
    };
    expect(resolveVehicles(state).find((v) => v.id === "vehicle.gazel")!.payload).toBe(2000);
    const reset: PresetsSnapshot = { ...state, vehicleOverrides: {} };
    expect(resolveVehicles(reset).find((v) => v.id === "vehicle.gazel")!.payload).toBe(1500);
  });

  it("resolveCargoPresets: оверрайд груза и пользовательский пресет", () => {
    const boxS = BUILTIN_CARGO_PRESETS.find((p) => p.id === "cargo.box.s")!;
    const custom = { ...boxS, id: "cargo.mine", name: "Мой", builtin: false };
    const state: PresetsSnapshot = {
      ...EMPTY,
      cargoOverrides: { "cargo.box.s": { ...boxS, name: "Изменённый" } },
      customCargo: [custom],
    };
    const all = resolveCargoPresets(state);
    expect(all.find((p) => p.id === "cargo.box.s")!.name).toBe("Изменённый");
    expect(all[all.length - 1].id).toBe("cargo.mine");
    // без оверрайда — встроенное имя
    expect(
      resolveCargoPresets({ ...EMPTY }).find((p) => p.id === "cargo.box.s")!.name
    ).toBe("Коробка S (400×300×250)");
  });

  it("findVehicle: достаёт известный и неизвестный id", () => {
    expect(findVehicle(EMPTY, "vehicle.euro")?.payload).toBe(20000);
    expect(findVehicle(EMPTY, "vehicle.нет-такого")).toBeUndefined();
  });

  it("съезжает неизменяемость: resolve не мутирует встроенные массивы", () => {
    const before = BUILTIN_VEHICLES.length;
    resolveVehicles(EMPTY);
    expect(BUILTIN_VEHICLES.length).toBe(before);
    expect(BUILTIN_VEHICLES.find((v) => v.id === "vehicle.gazel")!.payload).toBe(1500);
  });
});