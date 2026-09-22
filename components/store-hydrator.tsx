"use client";

import { useEffect } from "react";

import { useLayoutStore } from "@/store/use-layout-store";
import { usePresetsStore } from "@/store/use-presets-store";
import { useSessionsStore } from "@/store/use-sessions-store";
import { useUiStore } from "@/store/use-ui-store";

/**
 * Сторы с skipHydration: localStorage читается после гидратации React,
 * чтобы не было mismatch (сервер рендерит дефолты, клиент — сразу
 * сохранённое состояние). Обновление после mount — не ошибка гидратации.
 */
export function StoreHydrator() {
  useEffect(() => {
    void useLayoutStore.persist.rehydrate();
    void useUiStore.persist.rehydrate();
    void usePresetsStore.persist.rehydrate();
    void useSessionsStore.persist.rehydrate();
  }, []);
  return null;
}
