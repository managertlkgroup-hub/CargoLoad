import type { Gaps, PackMode } from "@/types";

/** Диапазоны валидации из ТЗ (в мм и кг). */
export const LIMITS = {
  /** длина кузова 1.5–53.5 м */
  vehicleLength: { min: 1500, max: 53500 },
  /** ширина кузова 1.2–10 м */
  vehicleWidth: { min: 1200, max: 10000 },
  /** высота кузова 0.3–8 м */
  vehicleHeight: { min: 300, max: 8000 },
  /** грузоподъёмность 0.1–500 т */
  payload: { min: 100, max: 500000 },
  /** длина груза 0.1–53.5 м */
  cargoLength: { min: 100, max: 53500 },
  /** ширина груза 0.1–10 м */
  cargoWidth: { min: 100, max: 10000 },
  /** высота груза 0.1–8 м */
  cargoHeight: { min: 100, max: 8000 },
  /** диаметр 0.1–9.5 м */
  diameter: { min: 100, max: 9500 },
  /** вес 0.01–500 т */
  weight: { min: 10, max: 500000 },
  /** количество 1–10000 */
  quantity: { min: 1, max: 10000 },
  /** макс. нагрузка сверху 0–500000 кг */
  maxTopLoad: { min: 0, max: 500000 },
  /** зазоры 0–авто (авто ≈ верхняя граница, подсказка предлагает разумное) */
  gaps: { min: 0, max: 5000, auto: 150 },
} as const;

/** Диапазоны сообщений об ошибках (для тостов). */
export const LIMIT_MESSAGES = {
  vehicleLength: "Длина кузова: 1.5–53.5 м",
  vehicleWidth: "Ширина кузова: 1.2–10 м",
  vehicleHeight: "Высота кузова: 0.3–8 м",
  payload: "Грузоподъёмность: 0.1–500 т",
  cargoLength: "Длина груза: 0.1–53.5 м",
  cargoWidth: "Ширина груза: 0.1–10 м",
  cargoHeight: "Высота груза: 0.1–8 м",
  diameter: "Диаметр: 0.1–9.5 м",
  weight: "Вес: 0.01–500 т",
  quantity: "Количество: 1–10000",
  maxTopLoad: "Макс. нагрузка сверху: 0–500000 кг",
  gaps: "Зазоры: 0–авто",
} as const;

/** Палитра грузов (в едином стиле продукта, не дефолтные primary). */
export const CARGO_COLORS = [
  "#8B5CF6",
  "#3EE0C5",
  "#F472B6",
  "#FBBF24",
  "#60A5FA",
  "#A3E635",
  "#FB7185",
  "#2DD4BF",
  "#C084FC",
  "#F97316",
  "#38BDF8",
  "#4ADE80",
] as const;

/** Группы совместимости. */
export const CARGO_GROUPS = [
  "general",
  "fragile",
  "food",
  "chemical",
  "metal",
  "machinery",
] as const;

export type CargoGroup = (typeof CARGO_GROUPS)[number];

export const CARGO_GROUP_LABELS: Record<CargoGroup, { ru: string; en: string }> = {
  general: { ru: "Общие", en: "General" },
  fragile: { ru: "Хрупкие", en: "Fragile" },
  food: { ru: "Пищевые", en: "Food" },
  chemical: { ru: "Химия", en: "Chemical" },
  metal: { ru: "Металл", en: "Metal" },
  machinery: { ru: "Оборудование", en: "Machinery" },
};

/** Шаги сетки для примагничивания, мм. */
export const GRID_SIZES = [25, 50, 100, 200] as const;

/** Порог примагничивания к стенкам/рёбрам, мм (ТЗ B1: срабатывает только < порога). */
export const SNAP_THRESHOLD = 50;

/** Доступные пороги магнита: 0 — выключен, 25/50/100 — мм. */
export const SNAP_THRESHOLDS = [0, 25, 50, 100] as const;
export type SnapThreshold = (typeof SNAP_THRESHOLDS)[number];

/** Допуск коллизии: касание разрешено (до -0.5 мм), пересечение запрещено. */
export const COLLISION_EPS = 0.5;

/** Дефолтные зазоры, мм (per-mode одинаково при первом запуске). */
export const DEFAULT_GAP: Gaps = { wall: 40, rowWidth: 40, rowLength: 80 };

export const DEFAULT_GAPS: Record<PackMode, Gaps> = {
  along: { ...DEFAULT_GAP },
  cross: { ...DEFAULT_GAP, rowLength: 40, rowWidth: 80 },
  mixed: { ...DEFAULT_GAP },
};

/** id автомобиля по умолчанию. */
export const DEFAULT_VEHICLE_ID = "vehicle.kamaz";

/** Лимит истории отмены/повтора. */
export const HISTORY_LIMIT = 50;

/** Максимум слоёв штабеля по умолчанию (0 = ограничение только кузовом). */
export const DEFAULT_MAX_LAYERS = 0;

/** Пороги критичности смещения центра тяжести, % от габарита. */
export const COG_THRESHOLDS = {
  warnLongitudinal: 7.5,
  critLongitudinal: 15,
  warnLateral: 4,
  critLateral: 8,
} as const;

/** Коэффициенты для расчёта крепления EN 12195-1. */
export const EN12195 = {
  /** коэффициент трения по умолчанию (сухой деревянный пол) */
  defaultMu: 0.3,
  /** коэффициент запаса */
  safetyFactor: 1.5,
  /** паспортное усилие стропов, даН */
  strapRatings: [1000, 2500, 5000] as const,
  /** гравитация, м/с² */
  g: 9.81,
} as const;
