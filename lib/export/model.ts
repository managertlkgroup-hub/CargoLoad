import type {
  CargoItem,
  Gaps,
  LayerInfo,
  LengthUnit,
  LoadMetrics,
  LoadStop,
  LoadingSide,
  Locale,
  PackMode,
  Placement,
  Unplaced,
  VehicleSpec,
  WeightUnit,
} from "@/types";

/**
 * Снимок текущей раскладки для экспортов (PDF / PNG / XLSX).
 * Собирается в hooks/use-export.ts из атомарного состояния стора.
 */
export interface ExportModel {
  items: CargoItem[];
  placements: Placement[];
  unplaced: Unplaced[];
  vehicle: VehicleSpec;
  mode: PackMode;
  /** зазоры ТЕКУЩЕГО режима */
  gaps: Gaps;
  /** зазоры ВСЕХ режимов (лист «Зазоры» в XLSX) */
  gapsByMode: Record<PackMode, Gaps>;
  stacking: boolean;
  lifo: boolean;
  maxLayers: number;
  loadingSide: LoadingSide;
  stops: LoadStop[];
  /** активный слой для PNG 2D («текущий вид»), -1 = все */
  activeLayer: number;
  /** слои раскладки для PNG 2D / PDF */
  layers: LayerInfo[];
  metrics: LoadMetrics | null;
  locale: Locale;
  lengthUnit: LengthUnit;
  weightUnit: WeightUnit;
  generatedAt: string;
}