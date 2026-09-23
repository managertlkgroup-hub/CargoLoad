"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { isShareHash, parseHash } from "@/lib/advanced/share";
import { translate } from "@/lib/i18n";
import { useLayoutStore } from "@/store/use-layout-store";
import { usePresetsStore } from "@/store/use-presets-store";
import { useSessionsStore } from "@/store/use-sessions-store";
import { useUiStore } from "@/store/use-ui-store";

/**
 * Сторы с skipHydration: localStorage читается после гидратации React,
 * чтобы не было mismatch (сервер рендерит дефолты, клиент — сохранённое).
 *
 * Зависимость от идентичности сторов: при HMR модуль стора выполняется
 * заново и создаётся НОВЫЙ instance с дефолтами — эффект перезапускается и
 * перечитывает storage (в проде идентичности стабильны — запуск один).
 *
 * Чек шири экрана выполняется строго ПОСЛЕ rehydrate — иначе сохранённое
 * состояние перезаписывает закрытие панелей.
 */
export function StoreHydrator() {
  useEffect(() => {
    void Promise.all([
      useLayoutStore.persist.rehydrate(),
      useUiStore.persist.rehydrate(),
      usePresetsStore.persist.rehydrate(),
      useSessionsStore.persist.rehydrate(),
    ]).then(async () => {
      // восстановление раскладки из share-ссылки (#s=…) поверх локального стора
      const hash = window.location.hash;
      if (isShareHash(hash)) {
        const shared = await parseHash(hash);
        if (shared) {
          useLayoutStore.getState().replaceSession(shared);
          history.replaceState(null, "", window.location.pathname + window.location.search);
          toast.success(translate(useUiStore.getState().locale, "toast.shareRestored"));
        } else {
          // ссылка есть, но данные повреждены — состояние локального стора не трогаем
          toast.error(translate(useUiStore.getState().locale, "toast.shareCorrupt"));
        }
      }
      // на узких экранах панели-шторки закрыты по умолчанию
      if (window.matchMedia("(max-width: 1023px)").matches) {
        useUiStore.getState().setLeftPanel(false);
        useUiStore.getState().setRightPanel(false);
      }
    });
    // идентичности сторов в deps: ре-гидратация после HMR-пересоздания
    // eslint-disable-next-line react-hooks/exhaustive-deps -- намеренно: HMR создаёт новый instance стора
  }, [useLayoutStore, useUiStore, usePresetsStore, useSessionsStore]);
  return null;
}
