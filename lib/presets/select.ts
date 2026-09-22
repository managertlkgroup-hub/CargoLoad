import type { CargoPreset, VehicleSpec } from "@/types";

import { BUILTIN_CARGO_PRESETS } from "@/lib/presets/cargo";
import { BUILTIN_VEHICLES } from "@/lib/presets/vehicles";

export interface PresetsSnapshot {
  cargoOverrides: Record<string, CargoPreset>;
  customCargo: CargoPreset[];
  vehicleOverrides: Record<string, VehicleSpec>;
  customVehicles: VehicleSpec[];
}

/** Итоговый список пресетов грузов: встроенные (с оверрайдами) + пользовательские. */
export function resolveCargoPresets(state: PresetsSnapshot): CargoPreset[] {
  const builtins = BUILTIN_CARGO_PRESETS.map(
    (p) => state.cargoOverrides[p.id] ?? p
  );
  return [...builtins, ...state.customCargo];
}

/** Итоговый список автомобилей: встроенные (с оверрайдами) + пользовательские. */
export function resolveVehicles(state: PresetsSnapshot): VehicleSpec[] {
  const builtins = BUILTIN_VEHICLES.map((v) => state.vehicleOverrides[v.id] ?? v);
  return [...builtins, ...state.customVehicles];
}

export function findVehicle(state: PresetsSnapshot, id: string): VehicleSpec | undefined {
  return (
    resolveVehicles(state).find((v) => v.id === id) ??
    BUILTIN_VEHICLES.find((v) => v.id === id)
  );
}
