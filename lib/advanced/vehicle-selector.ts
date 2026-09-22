import { dimsBase } from "@/lib/geometry";
import type { CargoItem, VehicleSpec } from "@/types";

/** Подбор числа машин под заданный список грузов (оценка по площади/массе/объёму). */

export interface VehicleCountResult {
  count: number;
  totalWeightKg: number;
  byFloorArea: number;
  byWeight: number;
  byVolume: number;
  usableFloorM2: number;
}

export function recommendVehicleCount(
  items: CargoItem[],
  vehicle: VehicleSpec,
  wallGap: number = 0
): VehicleCountResult {
  const wall = Math.max(0, wallGap);
  let floorAreaM2 = 0;
  let volumeM3 = 0;
  let totalWeightKg = 0;
  for (const item of items) {
    const d = dimsBase(item);
    floorAreaM2 += ((d.dx * d.dy) / 1e6) * item.quantity;
    volumeM3 += ((d.dx * d.dy * d.dz) / 1e9) * item.quantity;
    totalWeightKg += item.weight * item.quantity;
  }

  const usableL = Math.max(0, vehicle.innerLength - 2 * wall);
  const usableW = Math.max(0, vehicle.innerWidth - 2 * wall);
  const usableFloorM2 = (usableL * usableW) / 1e6;
  const usableVolM3 = (usableL * usableW * vehicle.innerHeight) / 1e9;

  const byFloorArea = floorAreaM2 <= 0 ? 1 : Math.max(1, Math.ceil(floorAreaM2 / usableFloorM2));
  const byVolume = volumeM3 <= 0 ? 1 : Math.max(1, Math.ceil(volumeM3 / usableVolM3));
  const byWeight =
    totalWeightKg <= 0 || vehicle.payload <= 0
      ? 1
      : Math.max(1, Math.ceil(totalWeightKg / vehicle.payload));

  return {
    count: Math.max(byFloorArea, byWeight, byVolume),
    totalWeightKg,
    byFloorArea,
    byWeight,
    byVolume,
    usableFloorM2,
  };
}