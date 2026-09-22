"use client";

import { Box, Cylinder, Triangle } from "lucide-react";
import { useEffect, useMemo } from "react";
import {
  useForm,
  type FieldErrors,
  type Resolver,
  type UseFormRegisterReturn,
} from "react-hook-form";
import { toast } from "sonner";

import { useT } from "@/hooks/use-t";
import { LIMITS } from "@/lib/constants";
import { genId } from "@/lib/id";
import { cargoItemSchema } from "@/lib/validation";
import { useLayoutStore } from "@/store/use-layout-store";
import { usePresetsStore } from "@/store/use-presets-store";
import { useUiStore } from "@/store/use-ui-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Segmented } from "@/components/segmented";
import type { CargoShape, CylinderAxis } from "@/types";

/** HEX-палитра быстрого выбора цвета. */
const SWATCHES = [
  "#8B5CF6",
  "#2DD4BF",
  "#F59E0B",
  "#EF4444",
  "#3B82F6",
  "#22C55E",
  "#EC4899",
  "#A3A3A3",
];

interface CargoFormValues {
  name: string;
  shape: CargoShape;
  length: number;
  width: number;
  height: number;
  diameter: number;
  weight: number;
  quantity: number;
  stackable: boolean;
  maxTopLoad: number;
  group: string;
  color: string;
  cylinderAxis: CylinderAxis;
  stopIndex: number;
}

const DEFAULTS: CargoFormValues = {
  name: "",
  shape: "box",
  length: 1200,
  width: 800,
  height: 600,
  diameter: 1000,
  weight: 100,
  quantity: 1,
  stackable: true,
  maxTopLoad: 500,
  group: "general",
  color: "#8B5CF6",
  cylinderAxis: "up",
  stopIndex: 0,
};

function clamp(v: number, r: { min: number; max: number }): number {
  if (!Number.isFinite(v)) return r.min;
  return Math.min(Math.max(v, r.min), r.max);
}

/**
 * Нормализация перед zod-схемой: у цилиндра ширина/высота = Ø (их dimsFor
 * не использует), у нештабелируемого груза нагрузка сверху = 0, у бокса
 * неиспользуемый диаметр зажимается в валидный диапазон.
 */
function normalize(v: CargoFormValues): CargoFormValues {
  if (v.shape === "cylinder") {
    const d = clamp(v.diameter, LIMITS.diameter);
    return { ...v, diameter: d, width: d, height: d };
  }
  const out = { ...v, diameter: clamp(v.diameter, LIMITS.diameter) };
  if (!out.stackable) out.maxTopLoad = 0;
  return out;
}

const resolver = (async (values: CargoFormValues) => {
  const norm = normalize(values);
  const r = cargoItemSchema.safeParse(norm);
  // RHF присваивает formState.errors результат resolver безусловно:
  // без errors: {} он станет undefined и рендер упадёт на errors.<field>.
  if (r.success) return { errors: {} as FieldErrors<CargoFormValues>, values: norm };
  const errors: Record<string, { type: string; message: string }> = {};
  for (const issue of r.error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !errors[key]) errors[key] = { type: "validation", message: issue.message };
  }
  return { errors: errors as unknown as FieldErrors<CargoFormValues> };
}) as unknown as Resolver<CargoFormValues>;

export function CargoDialog() {
  const t = useT();
  const dialog = useUiStore((s) => s.dialog);
  const dialogOpen = useUiStore((s) => s.dialogOpen);
  const closeDialog = useUiStore((s) => s.closeDialog);

  const items = useLayoutStore((s) => s.items);
  const stops = useLayoutStore((s) => s.stops);
  const addItem = useLayoutStore((s) => s.addItem);
  const updateItem = useLayoutStore((s) => s.updateItem);

  const presets = usePresetsStore((s) => s.cargoOverrides);
  const customCargo = usePresetsStore((s) => s.customCargo);
  const upsertCustomCargo = usePresetsStore((s) => s.upsertCustomCargo);
  const overrideBuiltinCargo = usePresetsStore((s) => s.overrideBuiltinCargo);
  const resetCargoPreset = usePresetsStore((s) => s.resetCargoPreset);

  const kind =
    dialog?.kind === "cargo" || dialog?.kind === "cargoPreset" ? dialog.kind : null;
  const itemId = dialog?.kind === "cargo" ? dialog.itemId : undefined;
  const presetId =
    dialog?.kind === "cargo" ? dialog.presetId : dialog?.kind === "cargoPreset" ? dialog.presetId : undefined;

  const open = dialogOpen && kind !== null;

  /** откуда забрать начальные значения */
  const initial = useMemo<CargoFormValues>(() => {
    if (kind === "cargo" && itemId) {
      const it = items.find((i) => i.id === itemId);
      if (it) {
        const { id: _id, presetId: _p, ...rest } = it;
        void _id;
        void _p;
        return { ...DEFAULTS, ...rest } as CargoFormValues;
      }
    }
    if (presetId) {
      const custom = customCargo.find((p) => p.id === presetId);
      const data = custom?.data ?? presets[presetId]?.data;
      if (data) {
        return { ...DEFAULTS, ...data } as CargoFormValues;
      }
    }
    return DEFAULTS;
  }, [kind, itemId, presetId, items, customCargo, presets]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CargoFormValues>({ resolver, defaultValues: DEFAULTS });

  useEffect(() => {
    if (open) reset(initial);
  }, [open, initial, reset]);

  const shape = watch("shape");
  const stackable = watch("stackable");
  const color = watch("color");

  const groupSuggestions = useMemo(() => {
    const set = new Set<string>(["general"]);
    for (const i of items) set.add(i.group);
    for (const p of Object.values(presets)) set.add(p.data.group);
    for (const p of customCargo) set.add(p.data.group);
    return [...set];
  }, [items, presets, customCargo]);

  const presetIsBuiltin = !!presetId && !customCargo.some((p) => p.id === presetId);
  const overridden = !!presetId && !!presets[presetId];

  const onSubmit = handleSubmit((values) => {
    if (kind === "cargoPreset") {
      if (presetId && presetIsBuiltin) {
        overrideBuiltinCargo(presetId, { name: values.name, data: values as never });
        toast(t("toast.updated"));
      } else {
        upsertCustomCargo({
          id: presetId ?? genId("cargo"),
          name: values.name,
          nameEn: customCargo.find((p) => p.id === presetId)?.nameEn ?? "",
          data: values as never,
        });
        toast(t("toast.presetSaved"));
      }
      closeDialog();
      return;
    }
    if (itemId) {
      updateItem(itemId, values);
      toast(t("toast.updated"));
    } else {
      addItem({ ...values, presetId });
      toast(t("toast.added"));
    }
    closeDialog();
  });

  const saveAsPreset = handleSubmit((values) => {
    upsertCustomCargo({ id: genId("cargo"), name: values.name, nameEn: "", data: values as never });
    toast(t("toast.presetSaved"));
  });

  const NUMERIC_FIELDS = new Set<string>([
    "length",
    "width",
    "height",
    "diameter",
    "weight",
    "quantity",
    "maxTopLoad",
    "stopIndex",
  ]);
  const field = (name: keyof CargoFormValues) => ({
    ...register(name, NUMERIC_FIELDS.has(name) ? { valueAsNumber: true } : {}),
  });

  const err = (name: keyof CargoFormValues) =>
    errors[name]?.message as string | undefined;

  const title =
    kind === "cargoPreset"
      ? presetId
        ? t("cargo.form.title.preset")
        : t("presets.new")
      : itemId
        ? t("cargo.form.title.edit")
        : t("cargo.form.title.add");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid gap-4">
          {/* название */}
          <div className="grid gap-1.5">
            <Label htmlFor="cargo-name">{t("cargo.field.name")}</Label>
            <Input
              id="cargo-name"
              placeholder={t("cargo.field.name")}
              autoComplete="off"
              {...register("name")}
            />
            {err("name") && <FieldError text={err("name")!} />}
          </div>

          {/* тип */}
          <div className="grid gap-1.5">
            <Label>{t("cargo.field.type")}</Label>
            <Segmented<CargoShape>
              id="shape"
              value={shape}
              onChange={(v) => setValue("shape", v, { shouldDirty: true })}
              ariaLabel={t("cargo.field.type")}
              className="w-full"
              options={[
                { value: "box", label: t("cargo.shape.box"), icon: Box },
                { value: "cylinder", label: t("cargo.shape.cylinder"), icon: Cylinder },
                { value: "oversize", label: t("cargo.shape.oversize"), icon: Triangle },
              ]}
            />
          </div>

          {/* габариты */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <NumField
              label={`${t("cargo.field.length")}, мм`}
              id="c-len"
              min={LIMITS.cargoLength.min}
              max={LIMITS.cargoLength.max}
              error={err("length")}
              register={field("length")}
            />
            {shape === "cylinder" ? (
              <NumField
                label={`${t("cargo.field.diameter")}, мм`}
                id="c-dia"
                min={LIMITS.diameter.min}
                max={LIMITS.diameter.max}
                error={err("diameter")}
                register={field("diameter")}
              />
            ) : (
              <>
                <NumField
                  label={`${t("cargo.field.width")}, мм`}
                  id="c-w"
                  min={LIMITS.cargoWidth.min}
                  max={LIMITS.cargoWidth.max}
                  error={err("width")}
                  register={field("width")}
                />
                <NumField
                  label={`${t("cargo.field.height")}, мм`}
                  id="c-h"
                  min={LIMITS.cargoHeight.min}
                  max={LIMITS.cargoHeight.max}
                  error={err("height")}
                  register={field("height")}
                />
              </>
            )}
            {shape === "cylinder" && (
              <div className="hidden">
                <input {...field("width")} tabIndex={-1} aria-hidden />
                <input {...field("height")} tabIndex={-1} aria-hidden />
              </div>
            )}
          </div>

          {/* вес / количество */}
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label={`${t("cargo.field.weight")}, кг`}
              id="c-wt"
              step="any"
              min={LIMITS.weight.min}
              max={LIMITS.weight.max}
              error={err("weight")}
              register={field("weight")}
            />
            <NumField
              label={t("cargo.field.quantity")}
              id="c-qty"
              min={LIMITS.quantity.min}
              max={LIMITS.quantity.max}
              error={err("quantity")}
              register={field("quantity")}
            />
          </div>

          {/* штабелирование */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-panel-soft/60 px-3 py-2.5">
            <Label htmlFor="c-stack" className="cursor-pointer">
              {t("cargo.stackable")}
            </Label>
            <Switch
              id="c-stack"
              checked={stackable}
              onCheckedChange={(v) => setValue("stackable", v, { shouldDirty: true })}
            />
          </div>
          {stackable && (
            <NumField
              label={`${t("cargo.maxTopLoad")}, кг`}
              id="c-mtl"
              step="any"
              min={LIMITS.maxTopLoad.min}
              max={LIMITS.maxTopLoad.max}
              error={err("maxTopLoad")}
              register={field("maxTopLoad")}
            />
          )}

          {/* группа / цвет */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="c-group">{t("cargo.group")}</Label>
              <Input id="c-group" list="cargo-groups" {...register("group")} />
              <datalist id="cargo-groups">
                {groupSuggestions.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
              {err("group") && <FieldError text={err("group")!} />}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-color">{t("cargo.field.color")}</Label>
              <div className="flex items-center gap-2">
                <input
                  id="c-color"
                  type="color"
                  value={color}
                  onChange={(e) => setValue("color", e.target.value, { shouldDirty: true })}
                  className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-border bg-panel-soft p-1"
                />
                <div className="flex flex-wrap gap-1.5">
                  {SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={c}
                      onClick={() => setValue("color", c, { shouldDirty: true })}
                      className={`size-5 rounded-md transition-transform hover:scale-110 ${
                        color.toLowerCase() === c.toLowerCase()
                          ? "ring-2 ring-ring ring-offset-2 ring-offset-panel"
                          : ""
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              {err("color") && <FieldError text={err("color")!} />}
            </div>
          </div>

          {/* ориентация цилиндра + точка выгрузки */}
          <div className="grid grid-cols-2 gap-3">
            {shape === "cylinder" && (
              <div className="grid gap-1.5">
                <Label>{t("cargo.field.axis")}</Label>
                <Select
                  value={watch("cylinderAxis")}
                  onValueChange={(v) =>
                    setValue("cylinderAxis", v as CylinderAxis, { shouldDirty: true })
                  }
                >
                  <SelectTrigger aria-label={t("cargo.field.axis")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="up">{t("cargo.axis.up")}</SelectItem>
                    <SelectItem value="side">{t("cargo.axis.side")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>{t("cargo.field.stop")}</Label>
              <Select
                value={String(watch("stopIndex"))}
                onValueChange={(v) => setValue("stopIndex", Number(v), { shouldDirty: true })}
              >
                <SelectTrigger aria-label={t("cargo.field.stop")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stops.map((s, i) => (
                    <SelectItem key={s.id} value={String(i)}>
                      {i + 1}. {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {err("maxTopLoad") && stackable && <FieldError text={err("maxTopLoad")!} />}
          {err("diameter") && shape !== "cylinder" && <FieldError text={err("diameter")!} />}
          {err("stopIndex") && <FieldError text={err("stopIndex")!} />}

          <DialogFooter className="flex-wrap items-center gap-2 sm:justify-between">
            <div className="flex items-center gap-2">
              {kind === "cargo" && !itemId && (
                <Button type="button" variant="ghost" size="sm" onClick={saveAsPreset}>
                  {t("cargo.savePreset")}
                </Button>
              )}
              {kind === "cargoPreset" && presetId && presetIsBuiltin && overridden && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    resetCargoPreset(presetId);
                    toast(t("toast.presetReset"));
                    closeDialog();
                  }}
                >
                  {t("action.reset")}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={closeDialog}>
                {t("action.cancel")}
              </Button>
              <Button type="submit">
                {kind === "cargoPreset" || itemId ? t("action.save") : t("action.add")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- маленькие помощники ----------------------------- */

function FieldError({ text }: { text: string }) {
  return <p className="text-[11.5px] leading-snug text-danger">{text}</p>;
}

function NumField({
  label,
  id,
  min,
  max,
  step,
  error,
  register,
}: {
  label: string;
  id: string;
  min?: number;
  max?: number;
  step?: string;
  error?: string;
  register: UseFormRegisterReturn;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step={step ?? "1"}
        min={min}
        max={max}
        className="tnum"
        {...register}
      />
      {error && <FieldError text={error} />}
    </div>
  );
}
