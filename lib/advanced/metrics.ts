import { COG_THRESHOLDS } from "@/lib/constants";
import { dimsBase, dimsFor, unitVolume } from "@/lib/geometry";
import { roundTo } from "@/lib/units";
import type {
  CargoItem,
  Gaps,
  LoadMetrics,
  PackMode,
  Placement,
  Unplaced,
  VehicleSpec,
} from "@/types";

/**
 * Единый расчёт метрик раскладки из атомарного снапшота store.
 *
 * Округление на границе вычисления (защита от «мусорных чисел»):
 *  - проценты (%) → 0.1
 *  - линейные размеры (мм) → 0.1
 *  - веса (кг) → 0.01
 *  - объёмы (м³) → 0.01
 *
 * Расчёт по единицам размещения: вес/объём и COG суммируются по каждой
 * единице, осевые нагрузки — рычажное распределение по ближайшим осям к COG.
 */

export interface MetricsInput {
  items: CargoItem[];
  placements: Placement[];
  /** неразмещённые единицы (агрегированные ядром упаковки) */
  unplaced: Unplaced[];
  vehicle: VehicleSpec;
  mode: PackMode;
  gaps: Gaps;
}

const EPS_LAYER = 1; // мм — допуск для уникальных слоёв

export function computeMetrics(input: MetricsInput): LoadMetrics {
  const { items, placements, unplaced, vehicle, gaps } = input;
  const L = vehicle.innerLength;
  const W = vehicle.innerWidth;
  const H = vehicle.innerHeight;

  const itemById = new Map(items.map((i) => [i.id, i]));

  const totalCount = items.reduce((s, i) => s + i.quantity, 0);
  const placedCount = placements.length;

  // — объём / вес —
  const volumeTotalM3 = roundTo((L * W * H) / 1e9, 2);
  let volumeUsedM3 = 0;
  let weightUsedKg = 0;
  let floorAreaM2 = 0;
  const cog = { x: 0, y: 0, z: 0 };
  let cogWeight = 0;

  // — габариты укладки —
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  const zSet = new Set<number>();

  for (const p of placements) {
    const item = itemById.get(p.itemId);
    if (!item) continue;
    const d = dimsFor(item, p.yaw, p.axis);

    volumeUsedM3 += unitVolume(item) / 1e9;
    weightUsedKg += item.weight;
    floorAreaM2 += (d.dx * d.dy) / 1e6;

    // центр тяжести каждой единицы — в центре её бокса
    const cx = p.x + d.dx / 2;
    const cy = p.y + d.dy / 2;
    const cz = p.z + d.dz / 2;
    cogWeight += item.weight;
    cog.x += item.weight * cx;
    cog.y += item.weight * cy;
    cog.z += item.weight * cz;

    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.x + d.dx > maxX) maxX = p.x + d.dx;
    if (p.y + d.dy > maxY) maxY = p.y + d.dy;
    if (p.z + d.dz > maxZ) maxZ = p.z + d.dz;

    zSet.add(Math.round(p.z / EPS_LAYER));
  }

  if (cogWeight > 0) {
    cog.x = roundTo(cog.x / cogWeight, 1);
    cog.y = roundTo(cog.y / cogWeight, 1);
    cog.z = roundTo(cog.z / cogWeight, 1);
  }

  volumeUsedM3 = roundTo(volumeUsedM3, 2);
  const volumeFreeM3 = roundTo(Math.max(0, volumeTotalM3 - volumeUsedM3), 2);
  const volumePct = roundTo(
    volumeTotalM3 > 0 ? (volumeUsedM3 / volumeTotalM3) * 100 : 0,
    1
  );

  weightUsedKg = roundTo(weightUsedKg, 2);
  const weightFreeKg = roundTo(Math.max(0, vehicle.payload - weightUsedKg), 2);
  const weightPct = roundTo(
    vehicle.payload > 0 ? (weightUsedKg / vehicle.payload) * 100 : 0,
    1
  );

  floorAreaM2 = roundTo(floorAreaM2, 2);
  const ldm = roundTo(floorAreaM2 / 2.4, 2);

  // — габариты укладки (0 если ничего не размещено) —
  const hasPlaced = placements.length > 0;
  const noGaps = hasPlaced
    ? {
        length: roundTo(maxX - minX, 1),
        width: roundTo(maxY - minY, 1),
        height: roundTo(maxZ - minZ, 1),
      }
    : { length: 0, width: 0, height: 0 };
  const withGaps = hasPlaced
    ? {
        length: roundTo(Math.min(L, maxX - minX + 2 * gaps.wall + gaps.rowLength), 1),
        width: roundTo(Math.min(W, maxY - minY + 2 * gaps.wall + gaps.rowWidth), 1),
        height: roundTo(Math.min(H, maxZ - minZ), 1),
      }
    : { length: 0, width: 0, height: 0 };

  // — штабелирование —
  const currentLayers = zSet.size;
  const canStack = currentLayers > 1;
  let maxLayersPhysical = 1;
  for (const item of items) {
    if (!item.stackable || item.maxTopLoad <= 0) continue;
    const dz = Math.max(item.height, item.width, item.length) || 0;
    if (dz <= 0) continue;
    const n = Math.floor(H / dz);
    if (n > maxLayersPhysical) maxLayersPhysical = n;
  }

  // — центр тяжести и пороги —
  const hasCargo = cogWeight > 0;
  const cogLongitudinalPct = roundTo(
    hasCargo && L > 0 ? ((cog.x - L / 2) / L) * 100 : 0,
    1
  );
  const cogLateralPct = roundTo(hasCargo && W > 0 ? ((cog.y - W / 2) / W) * 100 : 0, 1);
  const cogLevel: "ok" | "warn" | "crit" = !hasCargo
    ? "ok"
    : Math.abs(cogLongitudinalPct) > COG_THRESHOLDS.critLongitudinal ||
        Math.abs(cogLateralPct) > COG_THRESHOLDS.critLateral
      ? "crit"
      : Math.abs(cogLongitudinalPct) > COG_THRESHOLDS.warnLongitudinal ||
          Math.abs(cogLateralPct) > COG_THRESHOLDS.warnLateral
        ? "warn"
        : "ok";

  // — осевые нагрузки: снаряжённая доля + рычажное распределение груза —
  const axlesAvailable = vehicle.axles.length > 0;
  const cargoShares: Record<string, number> = {};

  // вес груза распределяется между двумя ближайшими к COG осями
  // (чем ближе ось — тем больше доля); одна ось — весь груз на неё
  if (cogWeight > 0 && vehicle.axles.length > 0) {
    const sorted = [...vehicle.axles].sort((a, b) => a.position - b.position);
    const cargoWeight = roundTo(weightUsedKg, 2);
    const near = sorted
      .map((a) => ({ id: a.id, d: Math.abs(a.position - cog.x) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    if (near.length === 1) {
      cargoShares[near[0].id] = cargoWeight;
    } else {
      const [f, s] = near;
      const sum = f.d + s.d;
      const shareFirst = sum === 0 ? 0.5 : s.d / sum;
      cargoShares[f.id] = cargoWeight * shareFirst;
      cargoShares[s.id] = cargoWeight * (1 - shareFirst);
    }
  }

  const axleOrder = new Map(vehicle.axles.map((a) => [a.id, a.position]));
  const axles = vehicle.axles
    .map((a) => {
      const loadKg = roundTo(a.tareShare * vehicle.tare + (cargoShares[a.id] ?? 0), 2);
      const pct = roundTo((loadKg / a.maxLoad) * 100, 1);
      return {
        axleId: a.id,
        label: a.label,
        loadKg,
        maxLoadKg: a.maxLoad,
        pct,
        overloaded: pct > 100,
      };
    })
    .sort((a, b) => (axleOrder.get(a.axleId) ?? 0) - (axleOrder.get(b.axleId) ?? 0));

  // — неразмещённые с весом и габаритами —
  const unplacedDetails = unplaced.map((u) => {
    const item = itemById.get(u.itemId);
    const d = item ? itemUnitDims(item) : { length: 0, width: 0, height: 0 };
    return {
      itemId: u.itemId,
      name: item?.name ?? u.itemId,
      quantity: u.quantity,
      weight: item?.weight ?? 0,
      length: d.length,
      width: d.width,
      height: d.height,
      reason: u.reason,
    };
  });

  return {
    volumeTotalM3,
    volumeUsedM3,
    volumeFreeM3,
    volumePct,
    weightCapacityKg: vehicle.payload,
    weightUsedKg,
    weightFreeKg,
    weightPct,
    bboxNoGaps: noGaps,
    bboxWithGaps: withGaps,
    canStack,
    currentLayers,
    maxLayers: maxLayersPhysical,
    ldm,
    floorAreaM2,
    cog: {
      x: cog.x,
      y: cog.y,
      z: cog.z,
      longitudinalPct: cogLongitudinalPct,
      lateralPct: cogLateralPct,
      level: cogLevel,
    },
    axles,
    axlesAvailable,
    placedCount,
    totalCount,
    unplaced: unplacedDetails,
  };
}

/** Габариты одной единицы для отображения (базовая ориентация). */
function itemUnitDims(item: CargoItem): { length: number; width: number; height: number } {
  const d = dimsBase(item);
  return { length: d.dx, width: d.dy, height: d.dz };
}