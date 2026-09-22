"use client";

import { useT } from "@/hooks/use-t";
import { useVehicle } from "@/hooks/use-vehicle";
import { useLayoutStore } from "@/store/use-layout-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LoadingSide } from "@/types";

const SIDES: LoadingSide[] = ["rear", "right", "left", "top"];

/** Тип загрузки/выгрузки: задняя, правый борт, левый борт, сверху. */
export function LoadingSideSelect() {
  const t = useT();
  const vehicle = useVehicle();
  const loadingSide = useLayoutStore((s) => s.loadingSide);
  const setLoadingSide = useLayoutStore((s) => s.setLoadingSide);

  if (vehicle.loadingSides.length <= 1) {
    return (
      <span className="hidden h-9 items-center rounded-xl border border-border bg-panel-soft px-3 text-[12px] text-muted md:inline-flex">
        {t(`loading.${vehicle.loadingSides[0]}`)}
      </span>
    );
  }

  return (
    <Select
      value={loadingSide}
      onValueChange={(v) => setLoadingSide(v as LoadingSide)}
    >
      <SelectTrigger className="h-9 w-[150px] text-xs" aria-label={t("vehicle.loadingSide")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SIDES.filter((s) => vehicle.loadingSides.includes(s)).map((s) => (
          <SelectItem key={s} value={s}>
            {t(`loading.${s}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
