import { create } from "zustand";
import { persist } from "zustand/middleware";

import { DEFAULT_GAPS, DEFAULT_VEHICLE_ID, HISTORY_LIMIT } from "@/lib/constants";
import { dimsFor } from "@/lib/geometry";
import { genId } from "@/lib/id";
import {
  boxesFor,
  placementBox,
  validateMove,
  type Box3,
} from "@/lib/packing/collide";
import { findVehicle } from "@/lib/presets/select";
import { usePresetsStore } from "@/store/use-presets-store";
import type {
  CargoItem,
  CargoItemDraft,
  Gaps,
  GapsByMode,
  LoadMetrics,
  LoadStop,
  LoadingSide,
  PackMode,
  PackResult,
  PackStatus,
  Placement,
  SessionData,
  Unplaced,
  LayerInfo,
  Yaw,
} from "@/types";

export type MoveResult = { ok: true } | { ok: false; error: string };

interface Snapshot {
  items: CargoItem[];
  placements: Placement[];
  stops: LoadStop[];
  mode: PackMode;
  gaps: GapsByMode;
  vehicleId: string;
  loadingSide: LoadingSide;
}

interface LayoutState {
  items: CargoItem[];
  vehicleId: string;
  loadingSide: LoadingSide;
  mode: PackMode;
  gaps: GapsByMode;
  placements: Placement[];
  unplaced: Unplaced[];
  layers: LayerInfo[];
  stops: LoadStop[];
  selectedIds: string[];
  packStatus: PackStatus;
  lastPackMs: number;
  /** метрики последнего расчёта (заполняет lib/packing/metrics) */
  metrics: LoadMetrics | null;

  past: Snapshot[];
  future: Snapshot[];

  // — грузы —
  addItem: (draft: CargoItemDraft) => string;
  addItems: (drafts: CargoItemDraft[]) => string[];
  updateItem: (id: string, patch: Partial<CargoItem>) => void;
  removeItems: (ids: string[]) => void;
  duplicateItems: (ids: string[]) => string[];

  // — автомобиль и режим —
  setVehicle: (id: string) => void;
  setLoadingSide: (side: LoadingSide) => void;
  setMode: (mode: PackMode) => void;
  setGaps: (mode: PackMode, gaps: Gaps) => void;

  // — раскладка —
  setPackResult: (result: PackResult, ms?: number) => void;
  setPackStatus: (status: PackStatus) => void;
  setMetrics: (metrics: LoadMetrics | null) => void;

  // — выделение —
  select: (id: string, additive?: boolean) => void;
  selectOnly: (id: string) => void;
  setSelected: (ids: string[]) => void;
  clearSelection: () => void;

  // — перемещения/повороты/слои —
  movePlacement: (placementId: string, x: number, y: number, z?: number) => MoveResult;
  rotatePlacement: (placementId: string) => MoveResult;
  changeItemLayer: (itemId: string, direction: -1 | 1) => MoveResult;

  // — мульти-стоп —
  addStop: (name: string) => string;
  renameStop: (id: string, name: string) => void;
  removeStop: (id: string) => void;

  // — история —
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  clearLayout: () => void;
  replaceSession: (data: SessionData) => void;
}

function makeItem(draft: CargoItemDraft): CargoItem {
  const { id, ...rest } = draft;
  return { ...rest, id: id ?? genId("item") };
}

function snapshot(s: LayoutState): Snapshot {
  return {
    items: s.items,
    placements: s.placements,
    stops: s.stops,
    mode: s.mode,
    gaps: s.gaps,
    vehicleId: s.vehicleId,
    loadingSide: s.loadingSide,
  };
}

function currentVehicle(state: LayoutState) {
  const presets = usePresetsStore.getState();
  return (
    findVehicle(presets, state.vehicleId) ?? findVehicle(presets, DEFAULT_VEHICLE_ID)!
  );
}

function geomMap(items: CargoItem[]): Map<string, CargoItem> {
  return new Map(items.map((i) => [i.id, i]));
}

const MOVE_ERRORS: Record<string, string> = {
  overlap: "Грузы пересекаются — перемещение отменено",
  bounds: "Груз выходит за габариты кузова — отменено",
  support: "Нет опоры под грузом — отменено",
  yaw: "Поворот невозможен: пересечение с другим грузом",
  layer: "Смена слоя невозможна: пересечение или нет опоры",
};

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      items: [],
      vehicleId: DEFAULT_VEHICLE_ID,
      loadingSide: "rear",
      mode: "along",
      gaps: DEFAULT_GAPS,
      placements: [],
      unplaced: [],
      layers: [],
      stops: [{ id: "stop.main", name: "Основная доставка" }],
      selectedIds: [],
      packStatus: "idle",
      lastPackMs: 0,
      metrics: null,
      past: [],
      future: [],

      addItem: (draft) => {
        const item = makeItem(draft);
        get().pushHistory();
        set((s) => ({ items: [...s.items, item] }));
        return item.id;
      },

      addItems: (drafts) => {
        const items = drafts.map(makeItem);
        get().pushHistory();
        set((s) => ({ items: [...s.items, ...items] }));
        return items.map((i) => i.id);
      },

      updateItem: (id, patch) => {
        get().pushHistory();
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
      },

      removeItems: (ids) => {
        const setIds = new Set(ids);
        get().pushHistory();
        set((s) => ({
          items: s.items.filter((i) => !setIds.has(i.id)),
          placements: s.placements.filter((p) => !setIds.has(p.itemId)),
          selectedIds: s.selectedIds.filter((sid) => !setIds.has(sid)),
        }));
      },

      duplicateItems: (ids) => {
        const setIds = new Set(ids);
        const src = get().items.filter((i) => setIds.has(i.id));
        const copies = src.map((i) => ({
          ...i,
          id: genId("item"),
          name: `${i.name} (копия)`,
        }));
        get().pushHistory();
        set((s) => ({ items: [...s.items, ...copies] }));
        return copies.map((c) => c.id);
      },

      setVehicle: (id) => {
        get().pushHistory();
        set((s) => {
          const vehicle = findVehicle(usePresetsStore.getState(), id);
          const loadingSide =
            vehicle && !vehicle.loadingSides.includes(s.loadingSide)
              ? vehicle.defaultLoadingSide
              : s.loadingSide;
          return { vehicleId: id, loadingSide };
        });
      },

      setLoadingSide: (side) => {
        const v = currentVehicle(get());
        if (!v.loadingSides.includes(side)) return;
        set({ loadingSide: side });
      },

      setMode: (mode) => {
        if (mode === get().mode) return;
        get().pushHistory();
        set({ mode });
      },

      setGaps: (mode, gaps) => {
        get().pushHistory();
        set((s) => ({ gaps: { ...s.gaps, [mode]: gaps } }));
      },

      setPackResult: (result, ms) => {
        set({
          placements: result.placements,
          unplaced: result.unplaced,
          layers: result.layers,
          packStatus: "done",
          lastPackMs: ms ?? result.durationMs,
        });
      },

      setPackStatus: (packStatus) => set({ packStatus }),
      setMetrics: (metrics) => set({ metrics }),

      select: (id, additive = false) =>
        set((s) => {
          if (!additive) return { selectedIds: [id] };
          return {
            selectedIds: s.selectedIds.includes(id)
              ? s.selectedIds.filter((x) => x !== id)
              : [...s.selectedIds, id],
          };
        }),

      selectOnly: (id) => set({ selectedIds: [id] }),

      setSelected: (ids) => set({ selectedIds: ids }),

      clearSelection: () => set({ selectedIds: [] }),

      movePlacement: (placementId, x, y, z) => {
        const s = get();
        const p = s.placements.find((pl) => pl.id === placementId);
        if (!p) return { ok: false, error: "Размещение не найдено" };
        const item = s.items.find((i) => i.id === p.itemId);
        if (!item) return { ok: false, error: "Груз не найден" };
        const vehicle = currentVehicle(s);

        const targetZ = z ?? p.z;
        const candidate = placementBox(item, { ...p, x, y, z: targetZ });
        const others = boxesFor(
          s.placements,
          geomMap(s.items),
          new Set([p.id])
        );
        const container = {
          dx: vehicle.innerLength,
          dy: vehicle.innerWidth,
          dz: vehicle.innerHeight,
        };
        const res = validateMove(candidate, others, container, targetZ !== p.z);
        if (!res.ok) return { ok: false, error: MOVE_ERRORS[res.reason ?? "overlap"] };

        s.pushHistory();
        set((st) => ({
          placements: st.placements.map((pl) =>
            pl.id === placementId ? { ...pl, x, y, z: targetZ } : pl
          ),
        }));
        return { ok: true };
      },

      rotatePlacement: (placementId) => {
        const s = get();
        const p = s.placements.find((pl) => pl.id === placementId);
        if (!p) return { ok: false, error: "Размещение не найдено" };
        const item = s.items.find((i) => i.id === p.itemId);
        if (!item) return { ok: false, error: "Груз не найден" };
        const vehicle = currentVehicle(s);

        const newYaw: Yaw = p.yaw === 0 ? 90 : 0;
        // при повороте вокруг центра — сдвигаем, чтобы центр остался на месте
        const before = dimsFor(item, p.yaw, p.axis);
        const after = dimsFor(item, newYaw, p.axis);
        const cx = p.x + before.dx / 2;
        const cy = p.y + before.dy / 2;
        const nx = Math.max(0, Math.round(cx - after.dx / 2));
        const ny = Math.max(0, Math.round(cy - after.dy / 2));

        const candidate = placementBox(item, { ...p, x: nx, y: ny, yaw: newYaw });
        const others = boxesFor(s.placements, geomMap(s.items), new Set([p.id]));
        const res = validateMove(
          candidate,
          others,
          { dx: vehicle.innerLength, dy: vehicle.innerWidth, dz: vehicle.innerHeight },
          false
        );
        if (!res.ok) return { ok: false, error: MOVE_ERRORS.yaw };

        s.pushHistory();
        set((st) => ({
          placements: st.placements.map((pl) =>
            pl.id === placementId ? { ...pl, yaw: newYaw, x: nx, y: ny } : pl
          ),
        }));
        return { ok: true };
      },

      changeItemLayer: (itemId, direction) => {
        const s = get();
        const unit = s.placements
          .filter((p) => p.itemId === itemId)
          .sort((a, b) => a.z - b.z || a.unitIndex - b.unitIndex)[0];
        if (!unit) return { ok: false, error: "Груз не размещён" };
        if (s.layers.length < 2) return { ok: false, error: "Слоёв всего один" };

        const curIdx = s.layers.findIndex((l) => Math.abs(l.z - unit.z) < 1);
        const targetIdx = curIdx + direction;
        if (targetIdx < 0 || targetIdx >= s.layers.length) {
          return { ok: false, error: "Больше нет слоёв" };
        }
        const targetZ = s.layers[targetIdx].z;

        // перемещаем все единицы этого груза на новый слой с валидацией
        const units = s.placements.filter((p) => p.itemId === itemId);
        const item = s.items.find((i) => i.id === itemId);
        if (!item) return { ok: false, error: "Груз не найден" };
        const vehicle = currentVehicle(s);
        const others = boxesFor(
          s.placements,
          geomMap(s.items),
          new Set(units.map((u) => u.id))
        );
        const container = {
          dx: vehicle.innerLength,
          dy: vehicle.innerWidth,
          dz: vehicle.innerHeight,
        };

        const moved: Box3[] = [];
        for (const u of units) {
          const box = placementBox(item, { ...u, z: targetZ });
          const res = validateMove(box, [...others, ...moved], container, true);
          if (!res.ok) return { ok: false, error: MOVE_ERRORS.layer };
          moved.push(box);
        }

        s.pushHistory();
        set((st) => ({
          placements: st.placements.map((pl) =>
            pl.itemId === itemId ? { ...pl, z: targetZ } : pl
          ),
        }));
        return { ok: true };
      },

      addStop: (name) => {
        const id = genId("stop");
        get().pushHistory();
        set((s) => ({ stops: [...s.stops, { id, name }] }));
        return id;
      },

      renameStop: (id, name) => {
        get().pushHistory();
        set((s) => ({ stops: s.stops.map((st) => (st.id === id ? { ...st, name } : st)) }));
      },

      removeStop: (id) => {
        const s = get();
        const idx = s.stops.findIndex((st) => st.id === id);
        if (idx < 0 || s.stops.length <= 1) return;
        s.pushHistory();
        set((st) => ({
          stops: st.stops.filter((x) => x.id !== id),
          items: st.items.map((i) =>
            i.stopIndex > idx
              ? { ...i, stopIndex: i.stopIndex - 1 }
              : i.stopIndex === idx
                ? { ...i, stopIndex: 0 }
                : i
          ),
        }));
      },

      pushHistory: () =>
        set((s) => ({
          past: [...s.past.slice(-(HISTORY_LIMIT - 1)), snapshot(s)],
          future: [],
        })),

      undo: () =>
        set((s) => {
          if (s.past.length === 0) return s;
          const prev = s.past[s.past.length - 1];
          return {
            ...prev,
            past: s.past.slice(0, -1),
            future: [snapshot(s), ...s.future].slice(0, HISTORY_LIMIT),
          };
        }),

      redo: () =>
        set((s) => {
          if (s.future.length === 0) return s;
          const next = s.future[0];
          return {
            ...next,
            past: [...s.past.slice(-(HISTORY_LIMIT - 1)), snapshot(s)],
            future: s.future.slice(1),
          };
        }),

      clearLayout: () => {
        get().pushHistory();
        set({
          items: [],
          placements: [],
          unplaced: [],
          layers: [],
          selectedIds: [],
          metrics: null,
          packStatus: "idle",
          stops: [{ id: "stop.main", name: "Основная доставка" }],
        });
      },

      replaceSession: (data) => {
        get().pushHistory();
        set({
          items: data.items,
          vehicleId: data.vehicleId,
          mode: data.mode,
          gaps: data.gaps,
          placements: data.placements,
          stops: data.stops,
          loadingSide: data.loadingSide ?? "rear",
          selectedIds: [],
          layers: [],
          unplaced: [],
          metrics: null,
          packStatus: "idle",
        });
      },
    }),
    {
      name: "cargoplanner.layout",
      version: 1,
      partialize: (s) => ({
        items: s.items,
        vehicleId: s.vehicleId,
        loadingSide: s.loadingSide,
        mode: s.mode,
        gaps: s.gaps,
        placements: s.placements,
        unplaced: s.unplaced,
        layers: s.layers,
        stops: s.stops,
      }),
    }
  )
);
