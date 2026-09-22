import type { CylinderAxis } from "@/types/cargo";

/** Режим раскладки: вдоль (все по X), поперёк (90°), смешанный (оптимально). */
export type PackMode = "along" | "cross" | "mixed";

export type Yaw = 0 | 90;

/** Зазоры в мм. Хранятся отдельно для каждого режима раскладки (per-mode). */
export interface Gaps {
  /** от стен кузова, мм */
  wall: number;
  /** между рядами по ширине (Y), мм */
  rowWidth: number;
  /** между рядами по длине (X), мм */
  rowLength: number;
}

export type GapsByMode = Record<PackMode, Gaps>;

/** Размещённая единица груза. Начало координат кузова — левый дальний нижний угол. */
export interface Placement {
  id: string;
  itemId: string;
  /** номер единицы внутри quantity (0-based) */
  unitIndex: number;
  /** мм по X (от передней стенки) */
  x: number;
  /** мм по Y (от левого борта) */
  y: number;
  /** мм по Z (от пола) */
  z: number;
  yaw: Yaw;
  /** ориентация цилиндра в этом размещении */
  axis: CylinderAxis;
  stopIndex: number;
}

export type UnplacedReason =
  | "no-space"
  | "too-big"
  | "weight-limit"
  | "height-limit";

export interface Unplaced {
  itemId: string;
  /** сколько единиц не поместилось */
  quantity: number;
  reason: UnplacedReason;
}

/** Информация о слое (уровне штабеля) по высоте. */
export interface LayerInfo {
  /** 0-based; 0 — пол */
  index: number;
  /** абсолютная высота начала слоя, мм */
  z: number;
}

export interface PackResult {
  placements: Placement[];
  unplaced: Unplaced[];
  layers: LayerInfo[];
  durationMs: number;
}

export interface PackRequest {
  /** id + геометрия грузов (items не отправляются целиком — только нужное) */
  items: import("@/types/cargo").CargoItem[];
  vehicle: import("@/types/vehicle").VehicleSpec;
  mode: PackMode;
  gaps: Gaps;
  /** учитывать ли штабелирование */
  stacking: boolean;
  /** ограничение слоёв (0 = без ограничения сверху кузова) */
  maxLayers: number;
  /** LIFO-приоритет: последняя точка выгрузки — ближе всего к двери */
  lifo: boolean;
}
