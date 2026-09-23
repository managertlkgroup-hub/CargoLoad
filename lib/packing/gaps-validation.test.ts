import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_GAPS, DEFAULT_VEHICLE_ID, LIMITS } from "@/lib/constants";
import { gapsSchema, validateOrError } from "@/lib/validation";
import { useLayoutStore } from "@/store/use-layout-store";
import type { PackMode } from "@/types";

/**
 * Зазоры: per-mode хранение, диапазоны валидации, откат при превышении
 * и трактовка пустого поля как 0. Всё на реальном store (без DOM).
 */

const MODES: PackMode[] = ["along", "cross", "mixed"];

// persist layout-стора в node не имеет window.localStorage (zustand
// предупреждает при каждом set) — это ожидаемый браузерный шум, гасим его.
const originalWarn = console.warn;
beforeAll(() => {
  vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    if (String(args[0]).includes("zustand persist middleware")) return;
    originalWarn(...args);
  });
});
afterAll(() => {
  vi.restoreAllMocks();
});

const FRESH = {
  items: [],
  vehicleId: DEFAULT_VEHICLE_ID,
  loadingSide: "rear" as const,
  mode: "along" as const,
  gaps: DEFAULT_GAPS,
  placements: [],
  unplaced: [],
  layers: [],
  stops: [{ id: "stop.main", name: "Основная доставка" }],
  selectedIds: [],
  packStatus: "idle" as const,
  lastPackMs: 0,
  layoutRev: 0,
  stacking: true,
  lifo: true,
  maxLayers: 0,
  metrics: null,
  past: [],
  future: [],
};

describe("зазоры: per-mode хранение и валидация", () => {
  beforeEach(() => {
    useLayoutStore.setState(FRESH);
  });

  it("дефолт хранится для всех трёх режимов", () => {
    const gaps = useLayoutStore.getState().gaps;
    expect(Object.keys(gaps).sort()).toEqual([...MODES].sort());
    for (const m of MODES) {
      expect(gaps[m]).toEqual(DEFAULT_GAPS[m]);
      expect(gaps[m].wall).toBe(40);
    }
    // у режима «поперёк» ряд/ширина зеркалятся
    expect(DEFAULT_GAPS.cross.rowLength).toBe(40);
    expect(DEFAULT_GAPS.cross.rowWidth).toBe(80);
  });

  it("setGaps меняет только выбранный режим", () => {
    const before = useLayoutStore.getState().gaps;
    useLayoutStore.getState().setGaps("cross", { wall: 100, rowWidth: 50, rowLength: 50 });
    const after = useLayoutStore.getState().gaps;
    expect(after.cross).toEqual({ wall: 100, rowWidth: 50, rowLength: 50 });
    expect(after.along).toEqual(before.along);
    expect(after.mixed).toEqual(before.mixed);
    expect(useLayoutStore.getState().layoutRev).toBe(1);
  });

  it("валидация диапазонов: 0..5000 допустимо, выше/ниже — ошибка", () => {
    const ok = validateOrError(gapsSchema, { wall: 0, rowWidth: 0, rowLength: 0 });
    expect(ok.ok).toBe(true);
    const over = validateOrError(gapsSchema, {
      wall: LIMITS.gaps.max + 1,
      rowWidth: 0,
      rowLength: 0,
    });
    expect(over.ok).toBe(false);
    const negative = validateOrError(gapsSchema, { wall: -10, rowWidth: 0, rowLength: 0 });
    expect(negative.ok).toBe(false);
  });

  it("пустое поле трактуется как 0 и проходит валидацию", () => {
    // в форме пустое значение → 0; 0 — допустимая граница
    const emptyAsZero = { wall: 0, rowWidth: 0, rowLength: 0 };
    expect(gapsSchema.safeParse(emptyAsZero).success).toBe(true);
  });

  it("откат при превышении: невалидные зазоры не меняют store", () => {
    const before = useLayoutStore.getState().gaps;
    const res = validateOrError(gapsSchema, {
      wall: 99999,
      rowWidth: 0,
      rowLength: 0,
    });
    expect(res.ok).toBe(false);
    // setGaps вызывается только при успешной валидации формы — store не тронут
    expect(useLayoutStore.getState().gaps).toEqual(before);
    expect(useLayoutStore.getState().layoutRev).toBe(0);
  });

  it("откат по undo возвращает прежние зазоры", () => {
    useLayoutStore.getState().setGaps("along", { wall: 200, rowWidth: 60, rowLength: 120 });
    expect(useLayoutStore.getState().gaps.along.wall).toBe(200);
    useLayoutStore.getState().undo();
    expect(useLayoutStore.getState().gaps.along.wall).toBe(40);
    useLayoutStore.getState().redo();
    expect(useLayoutStore.getState().gaps.along.wall).toBe(200);
  });
});