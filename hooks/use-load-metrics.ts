"use client";

import { useMemo } from "react";

import { useVehicle } from "@/hooks/use-vehicle";
import { computeMetrics } from "@/lib/advanced/metrics";
import { useLayoutStore } from "@/store/use-layout-store";
import type { LoadMetrics } from "@/types";

/**
 * Метрики раскладки из ОДНОГО атомарного снапшота store (полная подписка),
 * пересчитываются при любом изменении layout → счётчики и советы не «прыгают».
 * Пустой список грузов → metrics = null.
 */
export function useLoadMetrics(): LoadMetrics | null {
  const layout = useLayoutStore();
  const vehicle = useVehicle();

  return useMemo(() => {
    if (layout.items.length === 0) return null;
    return computeMetrics({
      items: layout.items,
      placements: layout.placements,
      unplaced: layout.unplaced,
      vehicle,
      mode: layout.mode,
      gaps: layout.gaps[layout.mode],
    });
  }, [layout, vehicle]);
}