"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { useCargoPresets, useVehicles } from "@/hooks/use-presets";
import { useT } from "@/hooks/use-t";
import { formatLength, formatWeight, lengthUnitLabel } from "@/lib/units";
import { useLayoutStore } from "@/store/use-layout-store";
import { usePresetsStore } from "@/store/use-presets-store";
import { useUiStore } from "@/store/use-ui-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CargoPreset } from "@/types";

type Tab = "cargo" | "vehicle";

/**
 * Менеджер пресетов: вкладки «Грузы»/«Автомобили», встроенные (редактируемые,
 * сбрасываемые) и пользовательские (редактируемые, удаляемые).
 */
export function PresetsDialog() {
  const t = useT();
  const dialog = useUiStore((s) => s.dialog);
  const dialogOpen = useUiStore((s) => s.dialogOpen);
  const closeDialog = useUiStore((s) => s.closeDialog);
  const openDialog = useUiStore((s) => s.openDialog);
  const locale = useUiStore((s) => s.locale);
  const addItem = useLayoutStore((s) => s.addItem);
  const cargoPresets = useCargoPresets();

  const open = dialogOpen && dialog?.kind === "presets";
  // стартовая вкладка приходит из dialog.tab; ручные переключатели перекрывают её
  const initialTab: Tab = dialog?.kind === "presets" ? dialog.tab ?? "cargo" : "cargo";
  const [tabOverride, setTabOverride] = useState<Tab | null>(null);
  const tab = tabOverride ?? initialTab;
  const [confirmId, setConfirmId] = useState<string | null>(null);

  /** добавить груз из пресета в раскладку (оставляет диалог открытым). */
  const addPresetToLayout = (id: string) => {
    const preset = cargoPresets.find((p) => p.id === id);
    if (!preset) return;
    const name = locale === "en" ? preset.nameEn || preset.name : preset.name;
    addItem({ ...preset.data, name, presetId: preset.id });
    toast(t("toast.added"));
  };

  return (
    <Dialog
      open={!!open}
      onOpenChange={(v) => {
        if (!v) {
          setConfirmId(null);
          setTabOverride(null);
          closeDialog();
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("presets.manage")}</DialogTitle>
          <DialogDescription className="sr-only">{t("presets.manage")}</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTabOverride(v as Tab)}>
          <TabsList className="w-full">
            <TabsTrigger value="cargo" className="flex-1">
              {t("presets.tab.cargo")}
            </TabsTrigger>
            <TabsTrigger value="vehicle" className="flex-1">
              {t("presets.tab.vehicle")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cargo">
            <CargoPresets
              confirmId={confirmId}
              setConfirmId={setConfirmId}
              onNew={() => openDialog({ kind: "cargoPreset" })}
              onEdit={(id) => openDialog({ kind: "cargoPreset", presetId: id })}
              onAdd={addPresetToLayout}
            />
          </TabsContent>
          <TabsContent value="vehicle">
            <VehiclePresets
              confirmId={confirmId}
              setConfirmId={setConfirmId}
              onNew={() => openDialog({ kind: "vehiclePreset" })}
              onEdit={(id) => openDialog({ kind: "vehiclePreset", presetId: id })}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

interface SectionProps {
  confirmId: string | null;
  setConfirmId: (id: string | null) => void;
  onNew: () => void;
  onEdit: (id: string) => void;
  onAdd?: (id: string) => void;
}

function SectionHeader({ onNew }: { onNew: () => void }) {
  const t = useT();
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="panel-label">{t("presets.builtin")}</span>
      <Button type="button" variant="outline" size="sm" onClick={onNew}>
        <Plus className="size-3.5" />
        {t("presets.new")}
      </Button>
    </div>
  );
}

function PresetActions({
  id,
  name,
  builtin,
  overridden,
  confirmId,
  setConfirmId,
  onEdit,
  onDelete,
  resetLabel,
  onAdd,
}: {
  id: string;
  name: string;
  builtin: boolean;
  overridden: boolean;
  confirmId: string | null;
  setConfirmId: (id: string | null) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  resetLabel: (id: string) => void;
  onAdd?: (id: string) => void;
}) {
  const t = useT();
  const confirming = confirmId === id;

  if (confirming) {
    return (
      <div className="flex shrink-0 gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-danger hover:text-danger"
          aria-label={t("action.confirm")}
          onClick={() => {
            onDelete(id);
            setConfirmId(null);
          }}
        >
          <Check className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("action.cancel")}
          onClick={() => setConfirmId(null)}
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 gap-0.5 opacity-70 transition-opacity group-hover:row:opacity-100 focus-within:opacity-100">
      {onAdd && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-accent"
          aria-label={t("cargo.add")}
          title={t("cargo.add")}
          onClick={() => onAdd(id)}
        >
          <Plus className="size-3.5" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("cargo.edit")}
        title={t("cargo.edit")}
        onClick={() => onEdit(id)}
      >
        <Pencil className="size-3.5" />
      </Button>
      {builtin && overridden && (
        <Button
          variant="ghost"
          size="sm"
          className="text-[11.5px]"
          onClick={() => resetLabel(id)}
        >
          {t("action.reset")}
        </Button>
      )}
      {!builtin && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="hover:text-danger"
          aria-label={t("action.delete")}
          title={t("presets.deleteConfirm", { name })}
          onClick={() => setConfirmId(id)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

function CargoPresets({ confirmId, setConfirmId, onNew, onEdit, onAdd }: SectionProps) {
  const t = useT();
  const locale = useUiStore((s) => s.locale);
  const lengthUnit = useUiStore((s) => s.lengthUnit);
  const weightUnit = useUiStore((s) => s.weightUnit);

  const presets = useCargoPresets();
  const cargoOverrides = usePresetsStore((s) => s.cargoOverrides);
  const deleteCustomCargo = usePresetsStore((s) => s.deleteCustomCargo);
  const resetCargoPreset = usePresetsStore((s) => s.resetCargoPreset);

  const builtin = presets.filter((p) => p.builtin);
  const custom = presets.filter((p) => !p.builtin);

  return (
    <div className="grid gap-3">
      <div>
        <SectionHeader onNew={onNew} />
        <ul className="grid gap-1.5">
          {builtin.map((p) => {
            const name = locale === "en" ? p.nameEn || p.name : p.name;
            return (
              <PresetRow
                key={p.id}
                color={p.data.color}
                name={name}
                dims={cargoDimsText(p, lengthUnit, locale)}
                weight={formatWeight(p.data.weight, weightUnit, locale)}
              >
                <PresetActions
                  id={p.id}
                  name={name}
                  builtin
                  overridden={!!cargoOverrides[p.id]}
                  confirmId={confirmId}
                  setConfirmId={setConfirmId}
                  onEdit={onEdit}
                  onDelete={() => undefined}
                  onAdd={onAdd}
                  resetLabel={(id) => {
                    resetCargoPreset(id);
                    toast(t("toast.presetReset"));
                  }}
                />
              </PresetRow>
            );
          })}
        </ul>
      </div>

      <div>
        <span className="panel-label">{t("presets.customSection")}</span>
        {custom.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-border-strong/70 px-3 py-3 text-center text-[12.5px] text-muted">
            {t("presets.empty")} — {t("presets.empty.hint")}
          </p>
        ) : (
          <ul className="mt-2 grid gap-1.5">
            {custom.map((p) => {
              const name = locale === "en" ? p.nameEn || p.name : p.name;
              return (
                <PresetRow
                  key={p.id}
                  color={p.data.color}
                  name={name}
                  dims={cargoDimsText(p, lengthUnit, locale)}
                  weight={formatWeight(p.data.weight, weightUnit, locale)}
                >
                  <PresetActions
                    id={p.id}
                    name={name}
                    builtin={false}
                    overridden={false}
                    confirmId={confirmId}
                    setConfirmId={setConfirmId}
                    onEdit={onEdit}
                    onAdd={onAdd}
                    onDelete={(id) => {
                      deleteCustomCargo(id);
                      toast(t("toast.presetDeleted"));
                    }}
                    resetLabel={() => undefined}
                  />
                </PresetRow>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function VehiclePresets({ confirmId, setConfirmId, onNew, onEdit }: SectionProps) {
  const t = useT();
  const locale = useUiStore((s) => s.locale);
  const lengthUnit = useUiStore((s) => s.lengthUnit);
  const weightUnit = useUiStore((s) => s.weightUnit);

  const vehicles = useVehicles();
  const vehicleOverrides = usePresetsStore((s) => s.vehicleOverrides);
  const deleteCustomVehicle = usePresetsStore((s) => s.deleteCustomVehicle);
  const resetVehicle = usePresetsStore((s) => s.resetVehicle);

  const builtin = vehicles.filter((v) => v.builtin);
  const custom = vehicles.filter((v) => !v.builtin);

  const row = (v: (typeof vehicles)[number], isBuiltin: boolean) => {
    const name = locale === "en" ? v.nameEn || v.name : v.name;
    const dims = `${v.bodyType} · ${formatLength(v.innerLength, lengthUnit, locale, false)} × ${formatLength(
      v.innerWidth,
      lengthUnit,
      locale,
      false
    )} × ${formatLength(v.innerHeight, lengthUnit, locale, false)} ${lengthUnitLabel(
      lengthUnit,
      locale
    )} · ${formatWeight(v.payload, weightUnit, locale)}`;
    return (
      <Tooltip key={v.id}>
        <TooltipTrigger asChild>
          <li className="group/row flex items-center gap-3 rounded-xl border border-border bg-panel-soft/60 p-2.5 transition-all duration-150 hover:border-border-strong hover:bg-panel">
            <span
              className="size-8 shrink-0 rounded-lg"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--primary))" }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="break-words text-[13px] font-medium leading-snug text-fg">{name}</div>
              <div className="tnum break-words text-[11px] leading-snug text-muted">{dims}</div>
            </div>
            <PresetActions
              id={v.id}
              name={name}
              builtin={isBuiltin}
              overridden={!!vehicleOverrides[v.id]}
              confirmId={confirmId}
              setConfirmId={setConfirmId}
              onEdit={onEdit}
              onDelete={(id) => {
                deleteCustomVehicle(id);
                toast(t("toast.presetDeleted"));
              }}
              resetLabel={(id) => {
                resetVehicle(id);
                toast(t("toast.vehicleReset"));
              }}
            />
          </li>
        </TooltipTrigger>
        <TooltipContent className="max-w-[280px]">
          <p className="font-semibold">{name}</p>
          <p className="tnum text-muted">{dims}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className="grid gap-3">
      <div>
        <SectionHeader onNew={onNew} />
        <ul className="grid gap-1.5">{builtin.map((v) => row(v, true))}</ul>
      </div>
      <div>
        <span className="panel-label">{t("presets.customSection")}</span>
        {custom.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-border-strong/70 px-3 py-3 text-center text-[12.5px] text-muted">
            {t("presets.empty")}
          </p>
        ) : (
          <ul className="mt-2 grid gap-1.5">{custom.map((v) => row(v, false))}</ul>
        )}
      </div>
    </div>
  );
}

/** Габариты пресета в текущих единицах: «1200 × 1000 × 1600 мм» / «Ø570 × 880 мм». */
function cargoDimsText(
  p: CargoPreset,
  unit: "mm" | "cm" | "m",
  locale: "ru" | "en"
): string {
  const u = lengthUnitLabel(unit, locale);
  if (p.data.shape === "cylinder") {
    return `Ø${formatLength(p.data.diameter, unit, locale, false)} × ${formatLength(
      p.data.length,
      unit,
      locale,
      false
    )} ${u}`;
  }
  return `${formatLength(p.data.length, unit, locale, false)} × ${formatLength(
    p.data.width,
    unit,
    locale,
    false
  )} × ${formatLength(p.data.height, unit, locale, false)} ${u}`;
}

function PresetRow({
  color,
  name,
  dims,
  weight,
  children,
}: {
  color: string;
  name: string;
  dims: string;
  weight?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <li className="group/row flex items-center gap-3 rounded-xl border border-border bg-panel-soft/60 p-2.5 transition-all duration-150 hover:border-border-strong hover:bg-panel">
          <span
            className="size-8 shrink-0 rounded-lg shadow-[0_2px_10px_-3px_rgba(0,0,0,0.4)]"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}aa)` }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="break-words text-[13px] font-medium leading-snug text-fg">
              {name}
            </div>
            <div className="tnum break-words text-[11px] leading-snug text-muted">
              {dims}
              {weight ? ` · ${weight}` : ""}
            </div>
          </div>
          {children}
        </li>
      </TooltipTrigger>
      <TooltipContent className="max-w-[280px]">
        <p className="font-semibold">{name}</p>
        <p className="tnum text-muted">
          {dims}
          {weight ? ` · ${weight}` : ""}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
