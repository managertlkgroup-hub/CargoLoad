import { packLayout } from "@/lib/packing/core";
import type {
  CargoItem,
  PackMode,
  UnplacedReason,
  VehicleSpec,
} from "@/types";

/**
 * Подбор автомобиля: синхронный прогон ядра упаковки по каждому кандидату
 * и сводка метрик (размещено, % объёма, % веса, неразмещённые).
 */

export interface FitUnplaced {
  itemId: string;
  name: string;
  quantity: number;
  weight: number;
  /** габариты одной единицы, мм (для цилиндра — Ø×Ø×L при axis=up) */
  length: number;
  width: number;
  height: number;
  reason: UnplacedReason;
}

export interface FitVehicle {
  vehicle: VehicleSpec;
  placedUnits: number;
  totalUnits: number;
  weightUsedKg: number;
  totalWeightKg: number;
  /** % занятого объёма кузова, округлён до 0.1 */
  volumePct: number;
  /** % использованной грузоподъёмности, округлён до 0.1 */
  weightPct: number;
  /** весь груз размещён и укладывается в грузоподъёмность */
  fits: boolean;
  /** не разместился из-за веса (негабарит объёма отражён в unplaced) */
  weightExceeded: boolean;
  unplaced: FitUnplaced[];
  layers: number;
}

export interface FitInput {
  items: CargoItem[];
  vehicles: VehicleSpec[];
  mode: PackMode;
  /** зазоры для текущего режима раскладки */
  gaps: { wall: number; rowWidth: number; rowLength: number };
  stacking: boolean;
  maxLayers: number;
  lifo: boolean;
  loadingSide: VehicleSpec["loadingSides"][number];
}

const EPS = 0.5;

function unitDims(item: CargoItem): { dx: number; dy: number; dz: number } {
  if (item.shape === "cylinder") {
    const d = item.diameter;
    // ориентация по умолчанию: на торце (Ø×Ø×L)
    return { dx: d, dy: d, dz: item.length };
  }
  return { dx: item.length, dy: item.width, dz: item.height };
}

function unplacedDetails(
  unplaced: { itemId: string; quantity: number; reason: UnplacedReason }[],
  items: CargoItem[]
): FitUnplaced[] {
  return unplaced
    .map((u) => {
      const item = items.find((i) => i.id === u.itemId);
      if (!item) return null;
      const d = unitDims(item);
      return {
        itemId: item.id,
        name: item.name,
        quantity: u.quantity,
        weight: item.weight,
        length: d.dx,
        width: d.dy,
        height: d.dz,
        reason: u.reason,
      };
    })
    .filter((x): x is FitUnplaced => x !== null);
}

/** Прогон одного автомобиля. Чистая функция — ничего не мутирует. */
export function evaluateVehicle(
  input: Omit<FitInput, "vehicles">,
  vehicle: VehicleSpec
): FitVehicle {
  const result = packLayout({
    items: input.items,
    vehicle,
    mode: input.mode,
    gaps: input.gaps,
    stacking: input.stacking,
    maxLayers: input.maxLayers,
    lifo: input.lifo,
    loadingSide: input.loadingSide,
  });

  const totalUnits = input.items.reduce((s, i) => s + i.quantity, 0);
  const placedUnits = result.placements.length;

  const weightById = new Map(input.items.map((i) => [i.id, i.weight]));
  const weightUsedKg = result.placements.reduce(
    (s, p) => s + (weightById.get(p.itemId) ?? 0),
    0
  );
  const totalWeightKg = input.items.reduce((s, i) => s + i.weight * i.quantity, 0);

  const volumeById = new Map(
    input.items.map((i) => {
      const d = unitDims(i);
      return [i.id, d.dx * d.dy * d.dz];
    })
  );
  const volumeUsed = result.placements.reduce(
    (s, p) => s + (volumeById.get(p.itemId) ?? 0),
    0
  );
  const vehicleVolume =
    vehicle.innerLength * vehicle.innerWidth * vehicle.innerHeight;

  const volumePct =
    totalUnits === 0 || vehicleVolume <= 0
      ? 0
      : Math.round((volumeUsed / vehicleVolume) * 1000) / 10;
  const weightPct =
    vehicle.payload <= 0
      ? 0
      : Math.round((weightUsedKg / vehicle.payload) * 1000) / 10;

  const weightExceeded = totalWeightKg > vehicle.payload + EPS;

  return {
    vehicle,
    placedUnits,
    totalUnits,
    weightUsedKg: Math.round(weightUsedKg * 100) / 100,
    totalWeightKg,
    volumePct,
    weightPct,
    fits: result.unplaced.length === 0 && !weightExceeded,
    weightExceeded,
    unplaced: unplacedDetails(result.unplaced, input.items),
    layers: result.layers.length,
  };
}

/**
 * Подбор по всем автомобилям с сортировкой (лучшие сверху):
 * сначала всё вмещающие, затем плотность объёма, затем грузоподъёмность,
 * затем наименьший кузов.
 */
export function evaluateVehicles(input: FitInput): FitVehicle[] {
  const { vehicles, ...rest } = input;
  const evaluated = vehicles.map((v) => evaluateVehicle(rest, v));
  evaluated.sort((a, b) => {
    if (a.fits !== b.fits) return a.fits ? -1 : 1;
    if (a.volumePct !== b.volumePct) return b.volumePct - a.volumePct;
    if (a.weightPct !== b.weightPct) return b.weightPct - a.weightPct;
    if (a.vehicle.innerLength !== b.vehicle.innerLength) {
      return a.vehicle.innerLength - b.vehicle.innerLength;
    }
    return a.vehicle.id < b.vehicle.id ? -1 : 1;
  });
  return evaluated;
}