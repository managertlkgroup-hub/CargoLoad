"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { useT } from "@/hooks/use-t";
import { useLayoutStore } from "@/store/use-layout-store";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    el.isContentEditable
  );
}

/**
 * Горячие клавиши: Ctrl+Z / Ctrl+Shift+Z (отмена/повтор),
 * Del (удалить), R (поворот 90°), Escape (снять выделение).
 */
export function useHotkeys() {
  const t = useT();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const store = useLayoutStore.getState();
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        store.undo();
        return;
      }
      if ((mod && e.key.toLowerCase() === "z" && e.shiftKey) || (mod && e.key.toLowerCase() === "y")) {
        e.preventDefault();
        store.redo();
        return;
      }
      if (e.key === "Escape") {
        store.clearSelection();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (store.selectedIds.length === 0) return;
        e.preventDefault();
        store.removeItems(store.selectedIds);
        store.clearSelection();
        toast(t("toast.removed"));
        return;
      }
      if (e.key.toLowerCase() === "r" && !mod) {
        if (store.selectedIds.length === 0) return;
        const itemId = store.selectedIds[0];
        const placement = store.placements.find((p) => p.itemId === itemId);
        if (!placement) return;
        e.preventDefault();
        const res = store.rotatePlacement(placement.id);
        if (!res.ok) toast.error(res.error ?? t("toast.moveFail"));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [t]);
}
