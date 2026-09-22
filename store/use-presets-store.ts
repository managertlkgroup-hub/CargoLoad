import { create } from "zustand";
import { persist } from "zustand/middleware";

import { genId } from "@/lib/id";
import { BUILTIN_CARGO_PRESETS } from "@/lib/presets/cargo";
import { BUILTIN_VEHICLES } from "@/lib/presets/vehicles";
import type { CargoPreset, VehicleSpec } from "@/types";

interface PresetsState {
  /** отредактированные встроенные пресеты грузов по id */
  cargoOverrides: Record<string, CargoPreset>;
  customCargo: CargoPreset[];
  /** отредактированные встроенные автомобили по id */
  vehicleOverrides: Record<string, VehicleSpec>;
  customVehicles: VehicleSpec[];

  /** создать/обновить пользовательский пресет груза */
  upsertCustomCargo: (preset: Omit<CargoPreset, "builtin"> & { id?: string }) => string;
  deleteCustomCargo: (id: string) => void;
  /** изменить встроенный пресет груза (сохраняется как оверрайд) */
  overrideBuiltinCargo: (id: string, patch: Partial<CargoPreset>) => void;
  resetCargoPreset: (id: string) => void;

  upsertCustomVehicle: (vehicle: Omit<VehicleSpec, "id" | "builtin"> & { id?: string }) => string;
  deleteCustomVehicle: (id: string) => void;
  overrideBuiltinVehicle: (id: string, patch: Partial<VehicleSpec>) => void;
  resetVehicle: (id: string) => void;
}

export const usePresetsStore = create<PresetsState>()(
  persist(
    (set, get) => ({
      cargoOverrides: {},
      customCargo: [],
      vehicleOverrides: {},
      customVehicles: [],

      upsertCustomCargo: (preset) => {
        const id = preset.id ?? genId("cargo");
        const existing = get().customCargo.some((p) => p.id === id);
        set((s) => ({
          customCargo: existing
            ? s.customCargo.map((p) => (p.id === id ? { ...p, ...preset, id, builtin: false } : p))
            : [...s.customCargo, { ...preset, id, builtin: false }],
        }));
        return id;
      },

      deleteCustomCargo: (id) =>
        set((s) => ({ customCargo: s.customCargo.filter((p) => p.id !== id) })),

      overrideBuiltinCargo: (id, patch) =>
        set((s) => {
          const base = BUILTIN_CARGO_PRESETS.find((p) => p.id === id);
          const current = s.cargoOverrides[id] ?? base;
          if (!current) return s;
          return {
            cargoOverrides: {
              ...s.cargoOverrides,
              [id]: { ...current, ...patch, id, builtin: true },
            },
          };
        }),

      resetCargoPreset: (id) =>
        set((s) => {
          const next = { ...s.cargoOverrides };
          delete next[id];
          return { cargoOverrides: next };
        }),

      upsertCustomVehicle: (vehicle) => {
        const id = vehicle.id ?? genId("veh");
        const existing = get().customVehicles.some((v) => v.id === id);
        set((s) => ({
          customVehicles: existing
            ? s.customVehicles.map((v) =>
                v.id === id ? { ...vehicle, id, builtin: false } : v
              )
            : [...s.customVehicles, { ...vehicle, id, builtin: false }],
        }));
        return id;
      },

      deleteCustomVehicle: (id) =>
        set((s) => ({ customVehicles: s.customVehicles.filter((v) => v.id !== id) })),

      overrideBuiltinVehicle: (id, patch) =>
        set((s) => {
          const base = BUILTIN_VEHICLES.find((v) => v.id === id);
          const current = s.vehicleOverrides[id] ?? base;
          if (!current) return s;
          return {
            vehicleOverrides: {
              ...s.vehicleOverrides,
              [id]: { ...current, ...patch, id, builtin: true },
            },
          };
        }),

      resetVehicle: (id) =>
        set((s) => {
          const next = { ...s.vehicleOverrides };
          delete next[id];
          return { vehicleOverrides: next };
        }),
    }),
    { name: "cargoplanner.presets", version: 1 }
  )
);
