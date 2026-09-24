"use client";

import { Check, ChevronDown, LayoutGrid, Pencil, Plus, ScanSearch, Truck } from "lucide-react";

import { useT } from "@/hooks/use-t";
import { useVehicle } from "@/hooks/use-vehicle";
import { useVehicles } from "@/hooks/use-presets";
import { cn } from "@/lib/utils";
import { formatLength, formatWeight, lengthUnitLabel } from "@/lib/units";
import { useLayoutStore } from "@/store/use-layout-store";
import { useUiStore } from "@/store/use-ui-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Выбор авто: карточка выбранного авто + выпадающий список с закреплённым
 * футером (подобрать / редактировать / все авто / создать новый). */
export function VehicleSelect() {
  const t = useT();
  const vehicle = useVehicle();
  const vehicles = useVehicles();
  const setVehicle = useLayoutStore((s) => s.setVehicle);
  const openDialog = useUiStore((s) => s.openDialog);
  const locale = useUiStore((s) => s.locale);
  const lengthUnit = useUiStore((s) => s.lengthUnit);
  const weightUnit = useUiStore((s) => s.weightUnit);

  const name = locale === "en" ? vehicle.nameEn || vehicle.name : vehicle.name;
  const dims = `${formatLength(vehicle.innerLength, lengthUnit, locale, false)} × ${formatLength(
    vehicle.innerWidth,
    lengthUnit,
    locale,
    false
  )} × ${formatLength(vehicle.innerHeight, lengthUnit, locale, false)} ${lengthUnitLabel(
    lengthUnit,
    locale
  )}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-auto min-w-[220px] items-center gap-2 rounded-xl border border-border-strong bg-panel-soft px-3 py-1.5 text-left text-sm text-fg shadow-sm transition-all duration-150 hover:bg-panel focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Truck className="size-4 shrink-0 self-start pt-0.5 text-accent" />
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="flex items-center gap-1.5">
              <span className="break-words text-sm leading-snug font-bold">{name}</span>
              <ChevronDown className="size-3.5 shrink-0 text-muted" />
            </span>
            <span className="tnum break-words text-[11px] leading-snug text-fg-2">{dims}</span>
            <span className="tnum break-words text-[11px] leading-snug text-muted">
              {t("vehicle.payload")}: {formatWeight(vehicle.payload, weightUnit, locale)}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[380px] p-0">
        {/* список авто — прокручивается */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          <div className="px-2 pb-1.5 pt-1 text-[11px] font-semibold tracking-widest text-muted uppercase">
            {t("vehicle.choose")}
          </div>
          {vehicles.map((v) => {
            const active = v.id === vehicle.id;
            const vName = locale === "en" ? v.nameEn || v.name : v.name;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setVehicle(v.id)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-all duration-150",
                  active
                    ? "border-primary/50 bg-primary/10"
                    : "border-transparent hover:border-border-strong hover:bg-panel-soft"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-semibold text-fg">{vName}</span>
                  {active && <Check className="size-4 shrink-0 text-primary" />}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                  <span>{v.bodyType}</span>
                  <span aria-hidden>·</span>
                  <span>{t(`vehicle.axleLayout.${v.axleLayout}`)}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px] text-fg-2">
                  <span className="tnum">
                    <span className="text-muted">{t("dims.l")} </span>
                    {formatLength(v.innerLength, lengthUnit, locale)}
                  </span>
                  <span className="tnum">
                    <span className="text-muted">{t("dims.w")} </span>
                    {formatLength(v.innerWidth, lengthUnit, locale)}
                  </span>
                  <span className="tnum">
                    <span className="text-muted">{t("dims.h")} </span>
                    {formatLength(v.innerHeight, lengthUnit, locale)}
                  </span>
                  <span className="tnum">
                    <span className="text-muted">{t("vehicle.payload")} </span>
                    {formatWeight(v.payload, weightUnit, locale)}
                  </span>
                </div>
                <div className="mt-1.5 text-[10.5px] text-muted">
                  {t("vehicle.dims")}:{" "}
                  {formatLength(v.innerLength, lengthUnit, locale, false)}×
                  {formatLength(v.innerWidth, lengthUnit, locale, false)}×
                  {formatLength(v.innerHeight, lengthUnit, locale, false)}{" "}
                  {lengthUnitLabel(lengthUnit, locale)}
                </div>
              </button>
            );
          })}
        </div>

        {/* закреплённый футер — всегда виден, не прокручивается */}
        <div className="grid grid-cols-2 gap-1 border-t border-border p-2">
          <DropdownMenuItem onClick={() => openDialog({ kind: "vehicleFit" })}>
            <ScanSearch className="size-4 text-accent" />
            {t("vehicle.pickFit")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openDialog({ kind: "vehiclePicker" })}>
            <LayoutGrid className="size-4 text-accent" />
            {t("vehicle.catalog")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openDialog({ kind: "vehiclePreset", presetId: vehicle.id })}
          >
            <Pencil className="size-4" />
            {t("vehicle.editCurrent")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openDialog({ kind: "vehiclePreset" })}>
            <Plus className="size-4 text-accent" />
            {t("vehicle.new")}
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}