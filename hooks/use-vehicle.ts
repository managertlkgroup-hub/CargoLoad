"use client";

import { useMemo } from "react";

import { DEFAULT_VEHICLE_ID } from "@/lib/constants";
import { findVehicle } from "@/lib/presets/select";
import { useLayoutStore } from "@/store/use-layout-store";
import { usePresetsStore } from "@/store/use-presets-store";
import type { VehicleSpec } from "@/types";

/** Текущий автомобиль (встроенный с оверрайдами или пользовательский). */
export function useVehicle(): VehicleSpec {
  const vehicleId = useLayoutStore((s) => s.vehicleId);
  const cargoOverrides = usePresetsStore((s) => s.cargoOverrides);
  const customCargo = usePresetsStore((s) => s.customCargo);
  const vehicleOverrides = usePresetsStore((s) => s.vehicleOverrides);
  const customVehicles = usePresetsStore((s) => s.customVehicles);

  return useMemo(
    () =>
      findVehicle(
        { cargoOverrides, customCargo, vehicleOverrides, customVehicles },
        vehicleId
      ) ?? findVehicle({ cargoOverrides, customCargo, vehicleOverrides, customVehicles }, DEFAULT_VEHICLE_ID)!,
    [vehicleId, cargoOverrides, customCargo, vehicleOverrides, customVehicles]
  );
}
