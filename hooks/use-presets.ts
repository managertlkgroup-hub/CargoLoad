"use client";

import { useMemo } from "react";

import { resolveCargoPresets, resolveVehicles } from "@/lib/presets/select";
import { usePresetsStore } from "@/store/use-presets-store";
import type { CargoPreset, VehicleSpec } from "@/types";

/** Итоговые списки пресетов с учётом оверрайдов. */
export function useVehicles(): VehicleSpec[] {
  const vehicleOverrides = usePresetsStore((s) => s.vehicleOverrides);
  const customVehicles = usePresetsStore((s) => s.customVehicles);
  const cargoOverrides = usePresetsStore((s) => s.cargoOverrides);
  const customCargo = usePresetsStore((s) => s.customCargo);
  return useMemo(
    () => resolveVehicles({ cargoOverrides, customCargo, vehicleOverrides, customVehicles }),
    [cargoOverrides, customCargo, vehicleOverrides, customVehicles]
  );
}

export function useCargoPresets(): CargoPreset[] {
  const cargoOverrides = usePresetsStore((s) => s.cargoOverrides);
  const customCargo = usePresetsStore((s) => s.customCargo);
  const vehicleOverrides = usePresetsStore((s) => s.vehicleOverrides);
  const customVehicles = usePresetsStore((s) => s.customVehicles);
  return useMemo(
    () => resolveCargoPresets({ cargoOverrides, customCargo, vehicleOverrides, customVehicles }),
    [cargoOverrides, customCargo, vehicleOverrides, customVehicles]
  );
}
