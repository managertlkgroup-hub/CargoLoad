import { create } from "zustand";
import { persist } from "zustand/middleware";

import { DEFAULT_VEHICLE_ID, GRID_SIZES } from "@/lib/constants";
import type { LengthUnit, Locale, ViewMode, WeightUnit } from "@/types";

/** Какой диалог открыт (одновременно максимум один; не персистится). */
export type DialogState =
  | { kind: "cargo"; itemId?: string; presetId?: string }
  | { kind: "cargoPreset"; presetId?: string }
  | { kind: "vehiclePreset"; presetId?: string }
  | { kind: "presets"; tab?: "cargo" | "vehicle" }
  | { kind: "sessions" }
  | { kind: "vehiclePicker" }
  | { kind: "vehicleFit" }
  | { kind: "import" };

interface UiState {
  locale: Locale;
  lengthUnit: LengthUnit;
  weightUnit: WeightUnit;
  /** активный вид — общий для 2D и 3D (слой не сбрасывается при переключении) */
  viewMode: ViewMode;
  /** активный слой: -1 = все слои */
  activeLayer: number;
  snapEnabled: boolean;
  gridSize: (typeof GRID_SIZES)[number];
  showLegend: boolean;
  showDimensions: boolean;
  showAiHints: boolean;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  /** открытый диалог (payload переживает закрытие — пока идёт анимация выхода) */
  dialog: DialogState | null;
  /** видим ли диалог прямо сейчас */
  dialogOpen: boolean;

  setLocale: (locale: Locale) => void;
  setUnits: (units: { lengthUnit?: LengthUnit; weightUnit?: WeightUnit }) => void;
  setViewMode: (mode: ViewMode) => void;
  setActiveLayer: (layer: number) => void;
  setSnapEnabled: (v: boolean) => void;
  setGridSize: (size: (typeof GRID_SIZES)[number]) => void;
  toggleLegend: () => void;
  toggleDimensions: () => void;
  toggleAiHints: () => void;
  setLeftPanel: (v: boolean) => void;
  setRightPanel: (v: boolean) => void;
  openDialog: (d: DialogState) => void;
  /** закрывает: dialogOpen=false, payload сохраняется до следующего openDialog,
   * чтобы заголовок/значения не мигали во время fade-out */
  closeDialog: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      locale: "ru",
      lengthUnit: "mm",
      weightUnit: "kg",
      viewMode: "2d",
      activeLayer: -1,
      snapEnabled: true,
      gridSize: GRID_SIZES[1],
      showLegend: true,
      showDimensions: true,
      showAiHints: true,
      leftPanelOpen: true,
      rightPanelOpen: true,
      dialog: null,
      dialogOpen: false,

      setLocale: (locale) => set({ locale }),
      setUnits: (units) => set(units),
      setViewMode: (viewMode) => set({ viewMode }),
      setActiveLayer: (activeLayer) => set({ activeLayer }),
      setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
      setGridSize: (gridSize) => set({ gridSize }),
      toggleLegend: () => set((s) => ({ showLegend: !s.showLegend })),
      toggleDimensions: () => set((s) => ({ showDimensions: !s.showDimensions })),
      toggleAiHints: () => set((s) => ({ showAiHints: !s.showAiHints })),
      setLeftPanel: (leftPanelOpen) => set({ leftPanelOpen }),
      setRightPanel: (rightPanelOpen) => set({ rightPanelOpen }),
      openDialog: (dialog) => set({ dialog, dialogOpen: true }),
      closeDialog: () => set({ dialogOpen: false }),
    }),
    {
      name: "cargoplanner.ui",
      version: 1,
      skipHydration: true,
      // dialog — осознанно не сохраняется
      partialize: (s) => ({
        locale: s.locale,
        lengthUnit: s.lengthUnit,
        weightUnit: s.weightUnit,
        viewMode: s.viewMode,
        activeLayer: s.activeLayer,
        snapEnabled: s.snapEnabled,
        gridSize: s.gridSize,
        showLegend: s.showLegend,
        showDimensions: s.showDimensions,
        showAiHints: s.showAiHints,
        leftPanelOpen: s.leftPanelOpen,
        rightPanelOpen: s.rightPanelOpen,
      }),
    }
  )
);

/** id автомобиля по умолчанию (используется layout-store). */
export const FALLBACK_VEHICLE_ID = DEFAULT_VEHICLE_ID;
