"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useT } from "@/hooks/use-t";
import { useVehicle } from "@/hooks/use-vehicle";
import { packAsync } from "@/lib/packing/run";
import { useLayoutStore } from "@/store/use-layout-store";

const DEBOUNCE_MS = 140;

/**
 * Автоматический пересчёт раскладки: следит за грузом/авто/режимом/зазорами,
 * дебаунсит и считает в Web Worker. Ручные перемещения (placements) не
 * триггерят пересчёт — отмена/повтор позиций работает.
 */
export function usePackEngine() {
  const t = useT();
  const items = useLayoutStore((s) => s.items);
  const mode = useLayoutStore((s) => s.mode);
  const gaps = useLayoutStore((s) => s.gaps);
  const loadingSide = useLayoutStore((s) => s.loadingSide);
  const stacking = useLayoutStore((s) => s.stacking);
  const lifo = useLayoutStore((s) => s.lifo);
  const maxLayers = useLayoutStore((s) => s.maxLayers);
  const vehicle = useVehicle();

  const rev = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const { setPackStatus, setPackResult } = useLayoutStore.getState();

    if (timer.current) clearTimeout(timer.current);

    if (items.length === 0) {
      rev.current++;
      setPackResult({ placements: [], unplaced: [], layers: [], durationMs: 0 });
      setPackStatus("idle");
      return;
    }

    setPackStatus("packing");
    timer.current = setTimeout(async () => {
      const myRev = ++rev.current;
      try {
        const result = await packAsync({
          items,
          vehicle,
          mode,
          gaps: gaps[mode],
          stacking,
          maxLayers,
          lifo,
          loadingSide,
        });
        if (myRev === rev.current) setPackResult(result);
      } catch {
        if (myRev === rev.current) {
          setPackStatus("done");
          toast.error(t("toast.packingError"));
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [items, vehicle, mode, gaps, loadingSide, stacking, lifo, maxLayers, t]);
}
