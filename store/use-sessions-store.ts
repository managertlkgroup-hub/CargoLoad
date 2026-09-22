import { create } from "zustand";
import { persist } from "zustand/middleware";

import { genId } from "@/lib/id";
import { useLayoutStore } from "@/store/use-layout-store";
import type { SavedSession, SessionData } from "@/types";

const MAX_SESSIONS = 30;

interface SessionsState {
  sessions: SavedSession[];
  /** сохранить текущую раскладку под именем (обновляет при совпадении имени) */
  saveSession: (name: string) => SavedSession;
  loadSession: (id: string) => boolean;
  removeSession: (id: string) => void;
}

function captureLayout(): SessionData {
  const s = useLayoutStore.getState();
  return {
    items: s.items,
    vehicleId: s.vehicleId,
    mode: s.mode,
    gaps: s.gaps,
    placements: s.placements,
    stops: s.stops,
    loadingSide: s.loadingSide,
    stacking: s.stacking,
    lifo: s.lifo,
    maxLayers: s.maxLayers,
  };
}

export const useSessionsStore = create<SessionsState>()(
  persist(
    (set, get) => ({
      sessions: [],

      saveSession: (name) => {
        const trimmed = name.trim();
        const now = Date.now();
        const existing = get().sessions.find((s) => s.name === trimmed);
        const session: SavedSession = existing
          ? { ...existing, updatedAt: now, data: captureLayout() }
          : {
              id: genId("sess"),
              name: trimmed,
              createdAt: now,
              updatedAt: now,
              data: captureLayout(),
            };

        set((s) => {
          const rest = s.sessions.filter((x) => x.id !== session.id);
          const next = [session, ...rest];
          // ограничение по количеству: удаляем самые старые
          return { sessions: next.slice(0, MAX_SESSIONS) };
        });
        return session;
      },

      loadSession: (id) => {
        const session = get().sessions.find((s) => s.id === id);
        if (!session) return false;
        useLayoutStore.getState().replaceSession(session.data);
        return true;
      },

      removeSession: (id) => set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) })),
    }),
    { name: "cargoplanner.sessions", version: 1, skipHydration: true }
  )
);
