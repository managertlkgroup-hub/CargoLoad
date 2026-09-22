"use client";

import { Check, Pencil, Truck } from "lucide-react";

import { useT } from "@/hooks/use-t";
import { useVehicles } from "@/hooks/use-presets";
import { formatLength, formatWeight } from "@/lib/units";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/store/use-layout-store";
import { useUiStore } from "@/store/use-ui-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * Каталог автомобилей: карточки с габаритами/грузоподъёмностью,
 * выбор кликом, редактирование — через карандаш.
 */
export function VehiclePickerDialog() {
  const t = useT();
  const locale = useUiStore((s) => s.locale);
  const lengthUnit = useUiStore((s) => s.lengthUnit);
  const weightUnit = useUiStore((s) => s.weightUnit);
  const dialog = useUiStore((s) => s.dialog);
  const dialogOpen = useUiStore((s) => s.dialogOpen);
  const closeDialog = useUiStore((s) => s.closeDialog);
  const openDialog = useUiStore((s) => s.openDialog);

  const vehicles = useVehicles();
  const vehicleId = useLayoutStore((s) => s.vehicleId);
  const setVehicle = useLayoutStore((s) => s.setVehicle);

  const open = dialogOpen && dialog?.kind === "vehiclePicker";

  return (
    <Dialog
      open={!!open}
      onOpenChange={(v) => {
        if (!v) closeDialog();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("vehicle.catalog")}</DialogTitle>
          <DialogDescription>{t("vehicle.catalog.hint")}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60dvh] pr-1">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {vehicles.map((v) => {
              const active = v.id === vehicleId;
              const name = locale === "en" ? v.nameEn || v.name : v.name;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    if (!active) setVehicle(v.id);
                    closeDialog();
                  }}
                  className={cn(
                    "group/card relative rounded-xl border p-3.5 text-left transition-all duration-150",
                    active
                      ? "border-primary/55 bg-primary/10 shadow-[0_0_0_1px_var(--glow-1)]"
                      : "border-border bg-panel-soft/60 hover:border-border-strong hover:bg-panel"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <Truck className="size-4 shrink-0 text-accent" />
                      <span className="truncate text-[14px] font-semibold text-fg">{name}</span>
                    </span>
                    {active && <Check className="size-4 shrink-0 text-primary" />}
                  </div>

                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                    <span>{v.bodyType}</span>
                    <span aria-hidden>·</span>
                    <span>{t(`vehicle.axleLayout.${v.axleLayout}`)}</span>
                  </div>

                  <div className="tnum mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px] text-fg-2">
                    <span>
                      <span className="text-muted">{t("dims.l")} </span>
                      {formatLength(v.innerLength, lengthUnit, locale)}
                    </span>
                    <span>
                      <span className="text-muted">{t("dims.w")} </span>
                      {formatLength(v.innerWidth, lengthUnit, locale)}
                    </span>
                    <span>
                      <span className="text-muted">{t("dims.h")} </span>
                      {formatLength(v.innerHeight, lengthUnit, locale)}
                    </span>
                    <span>
                      <span className="text-muted">{t("vehicle.payload")} </span>
                      {formatWeight(v.payload, weightUnit, locale)}
                    </span>
                  </div>

                  {/* карандаш — редактирование (не всплывает выбор карточки) */}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={t("cargo.edit")}
                    title={t("cargo.edit")}
                    onClick={(e) => {
                      e.stopPropagation();
                      openDialog({ kind: "vehiclePreset", presetId: v.id });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        openDialog({ kind: "vehiclePreset", presetId: v.id });
                      }
                    }}
                    className="absolute top-2.5 right-2.5 rounded-lg border border-border bg-panel-strong/80 p-1.5 text-muted opacity-0 transition-all duration-150 group-hover/card:opacity-100 hover:border-primary/50 hover:text-fg focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                  >
                    <Pencil className="size-3.5" />
                  </span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
