import { describe, expect, it } from "vitest";

import { createStore } from "zustand/vanilla";
import { createJSONStorage, persist } from "zustand/middleware";

import { decodeShare, encodeShare, parseHash, shareUrl } from "@/lib/advanced/share";
import { DEFAULT_GAPS, DEFAULT_VEHICLE_ID } from "@/lib/constants";
import { useLayoutStore } from "@/store/use-layout-store";
import type { CargoItem, GapsByMode, SessionData } from "@/types";

/**
 * Сериализация: persist-раундтрип layout-стора через JSON-хранилище,
 * миграция версии конфига, encode/decode шаринга, URL-хэш и кириллица.
 */

/** In-memory JSON-хранилище (водит себя как localStorage без DOM). */
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    _map: map,
  };
}

interface LayoutSlice {
  rev: number;
  vehicleId: string;
  mode: string;
  gaps: GapsByMode;
  items: CargoItem[];
}

function snapshotOf<T>(store: { getState: () => T }): T {
  return store.getState();
}

describe("serialization: persist-раундтрип layout-стора", () => {
  it("state сериализуется в JSON и восстанавливается без потерь", () => {
    const storage = memoryStorage();
    const useStore = createStore(
      persist<LayoutSlice>(
        () => ({
          rev: 0,
          vehicleId: "vehicle.euro",
          mode: "cross",
          gaps: { along: { wall: 40, rowWidth: 80, rowLength: 40 }, cross: { wall: 40, rowWidth: 40, rowLength: 80 }, mixed: { wall: 40, rowWidth: 80, rowLength: 40 } } satisfies GapsByMode,
          items: [],
        }),
        { name: "test.layout", version: 0, storage: createJSONStorage(() => storage) }
      )
    );
    // persist пишет только на мутацию — триггерим запись
    useStore.setState({ rev: 1 });
    const before = snapshotOf(useStore);
    const raw = storage._map.get("test.layout");
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.vehicleId).toBe("vehicle.euro");
    expect(parsed.state.mode).toBe("cross");
    expect(parsed.state.rev).toBe(1);

    // повторная гидрация из того же хранилища
    const smoke = createStore(
      persist<LayoutSlice>(
        () => ({ rev: 0, vehicleId: "x", mode: "along", gaps: DEFAULT_GAPS, items: [] }),
        { name: "test.layout", version: 0, storage: createJSONStorage(() => storage) }
      )
    );
    const restored = snapshotOf(smoke);
    expect(restored.vehicleId).toBe("vehicle.euro");
    expect(restored.mode).toBe("cross");
    expect(restored.gaps).toEqual(before.gaps);
    expect(restored.rev).toBe(1);
  });

  it("миграция версии 0 → 1: старый gaps разворачивается в gapsByMode", () => {
    const storage = memoryStorage();
    storage.setItem(
      "legacy.layout",
      JSON.stringify({ state: { gaps: { wall: 60, rowWidth: 20, rowLength: 20 }, items: [], vehicleId: DEFAULT_VEHICLE_ID }, version: 0 })
    );
    const migrated = createStore(
      persist<LayoutSlice>(
        () => ({ rev: 0, vehicleId: DEFAULT_VEHICLE_ID, mode: "along", items: [], gaps: DEFAULT_GAPS }),
        {
          name: "legacy.layout",
          version: 1,
          storage: createJSONStorage(() => storage),
          migrate: (state, version) => {
            const old = state as {
              gaps?: GapsByMode | { wall: number; rowWidth: number; rowLength: number };
            };
            // после migrate zustand мержит результат с дефолтами → partial достаточно
            if (version === 0 && old.gaps && !("along" in old.gaps)) {
              const g = old.gaps as { wall: number; rowWidth: number; rowLength: number };
              return { ...old, gaps: { along: g, cross: g, mixed: g } } as LayoutSlice;
            }
            return old as LayoutSlice;
          },
        }
      )
    );
    const s = snapshotOf(migrated);
    expect(s.gaps.along.wall).toBe(60);
    expect(s.gaps.cross.wall).toBe(60);
    expect(s.gaps.mixed).toEqual(s.gaps.cross);
  });

  it("обратная совместимость: отсутствие persisted-состояния → дефолты нового ключа", () => {
    const storage = memoryStorage();
    storage.setItem("empty.layout", JSON.stringify({ state: {}, version: 0 }));
    const fresh = createStore(
      persist<LayoutSlice>(
        () => ({ rev: 0, vehicleId: "vehicle.kamaz", mode: "along", items: [], gaps: DEFAULT_GAPS }),
        { name: "empty.layout", version: 0, storage: createJSONStorage(() => storage) }
      )
    );
    const s = snapshotOf(fresh);
    expect(s.vehicleId).toBe("vehicle.kamaz");
    expect(s.gaps).toEqual(DEFAULT_GAPS);
  });
});

describe("serialization: шаринг (base64url, кириллица, хэш)", () => {
  const session: SessionData = {
    vehicleId: "vehicle.euro",
    mode: "mixed",
    loadingSide: "rear",
    gaps: DEFAULT_GAPS,
    items: [
      {
        id: "cargo.1",
        name: "Ящик с сообщением: привет, мир!",
        shape: "box",
        length: 1200,
        width: 800,
        height: 800,
        diameter: 0,
        weight: 1200,
        quantity: 4,
        stackable: true,
        maxTopLoad: 1500,
        group: "general",
        color: "#22C55E",
        cylinderAxis: "up",
        stopIndex: 0,
      } satisfies CargoItem,
    ],
    placements: [],
    stops: [{ id: "stop.1", name: "Основная доставка" }],
  };

  it("encodeShare → decodeShare: данные не теряются", async () => {
    const encoded = await encodeShare(session);
    const payload = encoded.slice(2);
    expect(encoded.startsWith("s=")).toBe(true);
    // base64url: без паддинга, без '+' и '/'
    expect(/^[A-Za-z0-9_-]+$/.test(payload)).toBe(true);
    expect(payload).not.toContain("=");
    const decoded = await decodeShare(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.vehicleId).toBe("vehicle.euro");
    expect(decoded!.items).toHaveLength(1);
    expect(decoded!.items[0].name).toBe("Ящик с сообщением: привет, мир!");
    expect(decoded!.items[0].quantity).toBe(4);
    expect(decoded!.gaps).toEqual(DEFAULT_GAPS);
  });

  it("parseHash: извлекает и декодирует #s=...", async () => {
    // shareUrl нужен globalThis.location (в node нет) — подкладываем
    (globalThis as Record<string, unknown>).location = {
      origin: "https://cargo.example",
      pathname: "/app",
    };
    const url = await shareUrl(session);
    expect(url.startsWith("https://cargo.example/app#s=")).toBe(true);
    const hash = url.slice(url.indexOf("#"));
    const parsed = await parseHash(hash);
    expect(parsed).not.toBeNull();
    expect(parsed!.vehicleId).toBe("vehicle.euro");
    expect(parsed!.items[0].name).toMatch(/[а-яА-ЯёЁ]/);
  });

  it("мусорный хэш: parseHash не падает и возвращает null", async () => {
    expect(await parseHash("#s=%%%not-base64%%%")).toBeNull();
    expect(await parseHash("#other=1")).toBeNull();
    expect(await parseHash("")).toBeNull();
    expect(await parseHash("#s=rO0ADw")).toBeNull();
  });

  it("shareUrl ставит # перед параметром, URL декодируется обратно", async () => {
    (globalThis as Record<string, unknown>).location = {
      origin: "https://cargo.example",
      pathname: "/app",
    };
    const url = await shareUrl(session);
    expect(url.startsWith("https://cargo.example/app#s=")).toBe(true);
    const parsed = await parseHash(url.slice(url.indexOf("#")));
    expect(parsed).not.toBeNull();
    expect(parsed!.vehicleId).toBe("vehicle.euro");
    expect(parsed!.stops).toEqual(session.stops);
  });
});

describe("serialization: layout-store остаётся консистентным в node-окружении", () => {
  it("дефолтное состояние безопасно и не требует localStorage", () => {
    const s = useLayoutStore.getState();
    expect(s.vehicleId).toBe(DEFAULT_VEHICLE_ID);
    expect(s.gaps).toEqual(DEFAULT_GAPS);
    expect(Array.isArray(s.items)).toBe(true);
  });
});