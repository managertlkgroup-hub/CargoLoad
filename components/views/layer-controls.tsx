"use client";

import { ChevronDown, ChevronUp, SquareStack } from "lucide-react";
import { toast } from "sonner";

import { useT } from "@/hooks/use-t";
import { formatLength } from "@/lib/units";
import { useLayoutStore } from "@/store/use-layout-store";
import { useUiStore } from "@/store/use-ui-store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Селектор слоя (высота) + поднять/опустить слой выбранного груза.
 * Общий для 2D и 3D: активный слой живёт в ui-store и переживает
 * переключение вида (баг прошлого проекта — сброс слоя при 2D↔3D).
 */
export function LayerControls() {
  const t = useT();
  const locale = useUiStore((s) => s.locale);
  const lengthUnit = useUiStore((s) => s.lengthUnit);
  const activeLayer = useUiStore((s) => s.activeLayer);
  const setActiveLayer = useUiStore((s) => s.setActiveLayer);

  const layers = useLayoutStore((s) => s.layers);
  const placements = useLayoutStore((s) => s.placements);
  const selectedIds = useLayoutStore((s) => s.selectedIds);
  const changeItemLayer = useLayoutStore((s) => s.changeItemLayer);

  const selectedHasPlacement =
    !!selectedIds[0] && placements.some((p) => p.itemId === selectedIds[0]);

  const doChangeLayer = (direction: -1 | 1) => {
    if (!selectedIds[0]) return;
    const res = changeItemLayer(selectedIds[0], direction);
    if (!res.ok) toast.error(res.error ?? t("toast.moveFail"));
  };

  return (
    <div className="flex items-center gap-1">
      <Select value={String(activeLayer)} onValueChange={(v) => setActiveLayer(Number(v))}>
        <SelectTrigger
          className="h-7 w-[124px] rounded-lg px-2 text-[11.5px]"
          aria-label={t("layer.title")}
        >
          <SquareStack className="size-3.5 text-muted" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="-1">{t("layer.all")}</SelectItem>
          {layers.map((l) => (
            <SelectItem key={l.index} value={String(l.index)}>
              {t("layer.n", { n: l.index + 1 })} · {formatLength(l.z, lengthUnit, locale)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={!selectedHasPlacement}
        title={t("layer.up")}
        aria-label={t("layer.up")}
        onClick={() => doChangeLayer(1)}
      >
        <ChevronUp className="size-4" />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={!selectedHasPlacement}
        title={t("layer.down")}
        aria-label={t("layer.down")}
        onClick={() => doChangeLayer(-1)}
      >
        <ChevronDown className="size-4" />
      </Button>
    </div>
  );
}
