"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useT } from "@/hooks/use-t";
import { useVehicle } from "@/hooks/use-vehicle";
import { packAsync } from "@/lib/packing/run";
import { getCurrentVehicle, useLayoutStore } from "@/store/use-layout-store";

const DEBOUNCE_MS = 140;

/**
 * Автоматический пересчёт раскладки: следит за грузом/авто/режимом/зазорами,
 * дебаунсит и считает в Web Worker.
 *
 * Два режима:
 *  - keep (layoutRev не изменился): ручные позиции, восстановленная
 *    перезагрузка/сессия и уже размещённые грузы СОХРАНЯЮТСЯ — докладываются
 *    только новые единицы;
 *  - полная пересборка (пользователь явно сменил режим/зазоры/авто/стекинг) —
 *    keep не передаётся, упаковывается всё заново.
 *
 * Гонкоустойчивость: эффект может выполниться с устаревшим замыканием
 * (гидратация lands между рендером и эффектом, StrictMode double-invoke),
 * а ЛЮБАЯ запись в layout-store ДО прочитки localStorage стирает
 * сохранённую раскладку (persist пишет снапшот на каждый set()).
 * Поэтому: до hasHydrated() — никаких set(), все решения — по свежему getState().
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
  const layoutRev = useLayoutStore((s) => s.layoutRev);
  const vehicle = useVehicle();

  const rev = useRef(0);
  const prevRev = useRef(layoutRev);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);

    // явная смена параметров укладки → полная пересборка; иначе keep
    const layoutChanged = prevRev.current !== layoutRev;
    prevRev.current = layoutRev;

    // localStorage ещё не прочитан — ни одного set(), иначе persist
    // запишет дефолты и убьёт сохранённую раскладку
    if (!useLayoutStore.persist.hasHydrated()) {
      return;
    }

    const { setPackStatus, setPackResult } = useLayoutStore.getState();
    const st0 = useLayoutStore.getState();

    if (st0.items.length === 0) {
      rev.current++;
      if (st0.placements.length || st0.unplaced.length || st0.layers.length) {
        setPackResult({ placements: [], unplaced: [], layers: [], durationMs: 0 });
      } else {
        setPackStatus("idle");
      }
      return;
    }

    setPackStatus("packing");

    timer.current = setTimeout(async () => {
      const myRev = ++rev.current;
      const st = useLayoutStore.getState();
      if (st.items.length === 0) return;
      try {
        const keep = layoutChanged ? undefined : st.placements;
        const result = await packAsync({
          items: st.items,
          vehicle: getCurrentVehicle(),
          mode: st.mode,
          gaps: st.gaps[st.mode],
          stacking: st.stacking,
          maxLayers: st.maxLayers,
          lifo: st.lifo,
          loadingSide: st.loadingSide,
          keep,
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
  }, [items, vehicle, mode, gaps, loadingSide, stacking, lifo, maxLayers, layoutRev, t]);
}
