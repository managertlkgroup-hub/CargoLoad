"use client";

import { Check, CornerDownLeft, Layers, TriangleAlert, Truck } from "lucide-react";
import { useMemo, useState } from "react";

import { useVehicles } from "@/hooks/use-presets";
import { useT } from "@/hooks/use-t";
import { evaluateVehicles } from "@/lib/vehicle-fit";
import { formatLength, formatWeight } from "@/lib/units";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/store/use-layout-store";
import { useUiStore } from "@/store/use-ui-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { FitVehicle } from "@/lib/vehicle-fit";

const MAX_UNPLACED_VISIBLE = 3;

function reasonKey(reason: string): string {
  return `reason.${reason}`;
}

/**
 * Подбор автомобиля: прогон упаковки по каждому кандидату с метриками,
 * жёлтая подсветка невмещающихся, сортировка и сворачиваемый список
 * неразмещённых грузов («и ещё N»).
 */
export function VehicleFitDialog() {
  const t = useT();
  const locale = useUiStore((s) => s.locale);
  const lengthUnit = useUiStore((s) => s.lengthUnit);
  const weightUnit = useUiStore((s) => s.weightUnit);
  const dialog = useUiStore((s) => s.dialog);
  const dialogOpen = useUiStore((s) => s.dialogOpen);
  const closeDialog = useUiStore((s) => s.closeDialog);

  const items = useLayoutStore((s) => s.items);
  const mode = useLayoutStore((s) => s.mode);
  const gaps = useLayoutStore((s) => s.gaps);
  const stacking = useLayoutStore((s) => s.stacking);
  const maxLayers = useLayoutStore((s) => s.maxLayers);
  const lifo = useLayoutStore((s) => s.lifo);
  const loadingSide = useLayoutStore((s) => s.loadingSide);
  const vehicleId = useLayoutStore((s) => s.vehicleId);
  const setVehicle = useLayoutStore((s) => s.setVehicle);

  const vehicles = useVehicles();
  const open = dialogOpen && dialog?.kind === "vehicleFit";
  const [considerStacking, setConsiderStacking] = useState(stacking);

  const fits = useMemo(() => {
    if (!open) return [];
    return evaluateVehicles({
      items,
      vehicles,
      mode,
      gaps: gaps[mode],
      stacking: considerStacking,
      maxLayers,
      lifo,
      loadingSide,
    });
  }, [open, items, vehicles, mode, gaps, considerStacking, maxLayers, lifo, loadingSide]);

  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <Dialog
      open={!!open}
      onOpenChange={(v) => {
        if (!v) closeDialog();
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="size-4 text-accent" />
            {t("fit.title")}
          </DialogTitle>
          <DialogDescription>{t("fit.subtitle")}</DialogDescription>
        </DialogHeader>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong/70 p-6 text-center">
            <div className="rounded-2xl bg-accent/12 p-3.5">
              <Truck className="size-6 text-accent" />
            </div>
            <p className="text-sm font-medium text-fg-2">{t("fit.empty")}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-panel-soft/60 px-3 py-2.5">
              <Label htmlFor="fit-stack" className="cursor-pointer">
                <span>{t("fit.stack")}</span>
              </Label>
              <Switch
                id="fit-stack"
                checked={considerStacking}
                onCheckedChange={setConsiderStacking}
              />
            </div>

            <ScrollArea className="max-h-[52dvh] pr-1">
              <ul className="grid gap-2">
                {fits.map((f, index) => {
                  const current = f.vehicle.id === vehicleId;
                  return (
                    <FitRow
                      key={f.vehicle.id}
                      f={f}
                      index={index}
                      current={current}
                      totalUnits={totalUnits}
                      locale={locale}
                      lengthUnit={lengthUnit}
                      weightUnit={weightUnit}
                      onSelect={() => {
                        if (!current) setVehicle(f.vehicle.id);
                        closeDialog();
                      }}
                    />
                  );
                })}
              </ul>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FitRow({
  f,
  index,
  current,
  totalUnits,
  locale,
  lengthUnit,
  weightUnit,
  onSelect,
}: {
  f: FitVehicle;
  index: number;
  current: boolean;
  totalUnits: number;
  locale: "ru" | "en";
  lengthUnit: "mm" | "cm" | "m";
  weightUnit: "kg" | "t";
  onSelect: () => void;
}) {
  const t = useT();
  const v = f.vehicle;
  const name = locale === "en" ? v.nameEn || v.name : v.name;
  const label = index === 0 ? t("fit.best") : f.fits ? t("fit.fits") : t("fit.noFit");

  return (
    <li
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group/card relative rounded-xl border p-3.5 text-left transition-all duration-150 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
        current
          ? "border-primary/55 bg-primary/10 shadow-[0_0_0_1px_var(--glow-1)]"
          : f.fits
            ? "border-border bg-panel-soft/60 hover:border-border-strong hover:bg-panel"
            : "border-warning/45 bg-warning/8 hover:border-warning/70 hover:bg-warning/12"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold text-fg">{name}</span>
            {current && (
              <span className="flex items-center gap-1 text-[10.5px] font-semibold text-primary">
                <Check className="size-3" />
                {t("fit.current")}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
            <span>{v.bodyType}</span>
            <span aria-hidden>·</span>
            <span>{t(`vehicle.axleLayout.${v.axleLayout}`)}</span>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
            f.fits
              ? "bg-success/15 text-success"
              : "bg-warning/18 text-warning"
          )}
        >
          {label}
        </span>
      </div>

      <div className="tnum mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px] text-fg-2">
        <span>
          <span className="text-muted">{t("fit.placed", { a: f.placedUnits, b: totalUnits })}</span>
        </span>
        <span>
          <span className="text-muted">{t("fit.volume")} </span>
          {f.volumePct.toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
            maximumFractionDigits: 1,
          })}
          %
        </span>
        <span>
          <span className="text-muted">{t("fit.weight")} </span>
          {f.weightPct.toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
            maximumFractionDigits: 1,
          })}
          %
        </span>
        <span className="flex items-center gap-1">
          <Layers className="size-3 text-muted" />
          <span className="text-muted">{t("fit.layers", { n: f.layers })}</span>
        </span>
        <span>
          <span className="text-muted">Д×Ш×В </span>
          {formatLength(v.innerLength, lengthUnit, locale)} ×{" "}
          {formatLength(v.innerWidth, lengthUnit, locale)} ×{" "}
          {formatLength(v.innerHeight, lengthUnit, locale)}
        </span>
        <span>
          <span className="text-muted">{t("vehicle.payload")} </span>
          {formatWeight(v.payload, weightUnit, locale)}
        </span>
      </div>

      {!f.fits && (
        <div className="mt-2.5 rounded-lg border border-warning/25 bg-panel-strong/40 px-2.5 py-2">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-warning">
            <TriangleAlert className="size-3.5" />
            {t("fit.unplaced")}
          </div>
          <ul className="mt-1 grid gap-1">
            {f.unplaced.slice(0, MAX_UNPLACED_VISIBLE).map((u) => (
              <li key={u.itemId} className="flex items-center gap-2 text-[11.5px] text-fg-2">
                <span className="truncate">{u.name}</span>
                <span className="tnum shrink-0 font-semibold">×{u.quantity}</span>
                <span className="tnum shrink-0 text-muted">
                  {formatWeight(u.weight, weightUnit, locale)}
                </span>
                <span className="ml-auto shrink-0 text-[10.5px] text-warning/90">
                  {t(reasonKey(u.reason))}
                </span>
              </li>
            ))}
          </ul>
          {f.unplaced.length > MAX_UNPLACED_VISIBLE && (
            <div className="mt-1 text-[10.5px] text-muted">
              {t("fit.andMore", { n: f.unplaced.length - MAX_UNPLACED_VISIBLE })}
            </div>
          )}
          {f.weightExceeded && f.unplaced.length <= MAX_UNPLACED_VISIBLE && (
            <div className="mt-1 text-[10.5px] text-warning/90">{t("fit.weightExceeded")}</div>
          )}
        </div>
      )}

      {!current && (
        <div className="mt-2 flex items-center gap-1 text-[10.5px] text-muted transition-colors group-hover/card:text-fg-2">
          <CornerDownLeft className="size-3" />
          {t("fit.select")}
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2 w-full opacity-0 transition-opacity focus-visible:opacity-100 group-hover/card:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {t("fit.select")}
      </Button>
    </li>
  );
}