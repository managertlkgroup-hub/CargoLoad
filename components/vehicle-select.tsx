"use client";

import { Check, ChevronDown, LayoutGrid, Pencil, ScanSearch, Truck } from "lucide-react";

import { useT } from "@/hooks/use-t";
import { useVehicle } from "@/hooks/use-vehicle";
import { useVehicles } from "@/hooks/use-presets";
import { cn } from "@/lib/utils";
import { formatLength, formatNumber, formatWeight } from "@/lib/units";
import { useLayoutStore } from "@/store/use-layout-store";
import { useUiStore } from "@/store/use-ui-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Выбор авто: выпадающий список с карточками габаритов и грузоподъёмности. */
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
  const dimsShort = `${formatLength(vehicle.innerLength, lengthUnit, locale, false)}×${formatLength(vehicle.innerWidth, lengthUnit, locale, false)}×${formatLength(vehicle.innerHeight, lengthUnit, locale, false)}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 max-w-[260px] items-center gap-2 rounded-xl border border-border-strong bg-panel-soft px-3 text-sm text-fg shadow-sm transition-all duration-150 hover:bg-panel focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Truck className="size-4 shrink-0 text-accent" />
          <span className="truncate font-medium">{name}</span>
          <span className="hidden truncate text-[11px] text-muted xl:inline">{dimsShort}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="max-h-[70vh] w-[380px] overflow-y-auto p-2">
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
                  <span className="text-muted">Д </span>
                  {formatLength(v.innerLength, lengthUnit, locale)}
                </span>
                <span className="tnum">
                  <span className="text-muted">Ш </span>
                  {formatLength(v.innerWidth, lengthUnit, locale)}
                </span>
                <span className="tnum">
                  <span className="text-muted">В </span>
                  {formatLength(v.innerHeight, lengthUnit, locale)}
                </span>
                <span className="tnum">
                  <span className="text-muted">{t("vehicle.payload")} </span>
                  {formatWeight(v.payload, weightUnit, locale)}
                </span>
              </div>
              <div className="mt-1.5 text-[10.5px] text-muted">
                {t("vehicle.dims")}: {formatNumber(v.innerLength / 1000, 2, locale)}×
                {formatNumber(v.innerWidth / 1000, 2, locale)}×
                {formatNumber(v.innerHeight / 1000, 2, locale)} м
              </div>
            </button>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openDialog({ kind: "vehicleFit" })}>
          <ScanSearch className="size-4 text-accent" />
          {t("vehicle.pickFit")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openDialog({ kind: "vehiclePicker" })}>
          <LayoutGrid className="size-4 text-accent" />
          {t("vehicle.catalog")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openDialog({ kind: "vehiclePreset", presetId: vehicle.id })}>
          <Pencil className="size-4" />
          {t("vehicle.editCurrent")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
