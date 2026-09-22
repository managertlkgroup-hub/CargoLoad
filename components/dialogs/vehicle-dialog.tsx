"use client";

import { Container, Plus, Trash2, Truck } from "lucide-react";
import { useEffect, useMemo } from "react";
import {
  useForm,
  type FieldErrors,
  type Resolver,
} from "react-hook-form";
import { toast } from "sonner";

import { useVehicles } from "@/hooks/use-presets";
import { useT } from "@/hooks/use-t";
import { roundTo } from "@/lib/units";
import { createVehicleSchema, type T } from "@/lib/validation";
import { useLayoutStore } from "@/store/use-layout-store";
import { usePresetsStore } from "@/store/use-presets-store";
import { useUiStore } from "@/store/use-ui-store";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { Axle, LoadingSide } from "@/types";

type AxleLayout = "rigid" | "tractor-semi";

interface VehicleFormValues {
  name: string;
  nameEn: string;
  bodyType: string;
  innerLength: number;
  innerWidth: number;
  innerHeight: number;
  payload: number;
  tare: number;
  axleLayout: AxleLayout;
  axles: Axle[];
  loadingSides: LoadingSide[];
  defaultLoadingSide: LoadingSide;
}

type AxleRowErrors = {
  label?: { message?: string };
  position?: { message?: string };
  maxLoad?: { message?: string };
  tareShare?: { message?: string };
};

const SIDES: LoadingSide[] = ["rear", "right", "left", "top"];

/** Достаёт message у произвольного узла ошибки RHF (включая корень массива). */
function msg(node: unknown): string | undefined {
  if (node && typeof node === "object" && "message" in node) {
    const m = (node as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return undefined;
}

function makeDefault(
  t: (k: string, v?: Record<string, string | number>) => string
): VehicleFormValues {
  return {
    name: "",
    nameEn: "",
    bodyType: "",
    innerLength: 6200,
    innerWidth: 2450,
    innerHeight: 2500,
    payload: 10000,
    tare: 7600,
    axleLayout: "rigid",
    axles: [
      {
        id: "axle.front",
        label: t("vehicle.axle.front"),
        position: -2000,
        maxLoad: 6000,
        tareShare: 0.5,
      },
      {
        id: "axle.rear",
        label: t("vehicle.axle.rear"),
        position: 5000,
        maxLoad: 10000,
        tareShare: 0.5,
      },
    ],
    loadingSides: ["rear", "right", "left", "top"],
    defaultLoadingSide: "rear",
  };
}

/** Равномерный перевод долей снаряжённой массы (последняя добирает остаток). */
function evenShares(axles: Axle[]): Axle[] {
  const n = axles.length;
  if (n === 0) return axles;
  const each = roundTo(1 / n, 3);
  let acc = 0;
  return axles.map((a, i) => {
    const share = i === n - 1 ? roundTo(1 - acc, 3) : each;
    acc += share;
    return { ...a, tareShare: share };
  });
}

/** Пишет zod-ошибки вложенными путями (axles.0.label), как ждёт RHF. */
function assignPath(
  target: Record<string, unknown>,
  path: (string | number)[],
  node: unknown
): void {
  if (path.length === 0) return;
  let cur: Record<string | number, unknown> = target;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i] as string | number;
    if (cur[k] == null) cur[k] = typeof path[i + 1] === "number" ? [] : {};
    cur = cur[k] as Record<string | number, unknown>;
  }
  const last = path[path.length - 1] as string | number;
  if (cur[last] == null) cur[last] = node;
}

const resolverFor = (t: T): Resolver<VehicleFormValues> =>
  (async (values: VehicleFormValues) => {
    const r = createVehicleSchema(t).safeParse(values);
    // RHF присваивает formState.errors результат resolver безусловно:
    // без errors: {} он станет undefined и рендер упадёт на errors.<field>.
    if (r.success) return { errors: {} as FieldErrors<VehicleFormValues>, values };
    const errors: Record<string, unknown> = {};
    for (const issue of r.error.issues) {
      const path = issue.path.filter((p) => typeof p !== "symbol") as (string | number)[];
      assignPath(errors, path, { type: "validation", message: issue.message });
    }
    return { errors: errors as unknown as FieldErrors<VehicleFormValues> };
  }) as unknown as Resolver<VehicleFormValues>;

export function VehicleDialog() {
  const t = useT();
  const dialog = useUiStore((s) => s.dialog);
  const dialogOpen = useUiStore((s) => s.dialogOpen);
  const closeDialog = useUiStore((s) => s.closeDialog);

  const vehicles = useVehicles();
  const customVehicles = usePresetsStore((s) => s.customVehicles);
  const vehicleOverrides = usePresetsStore((s) => s.vehicleOverrides);
  const upsertCustomVehicle = usePresetsStore((s) => s.upsertCustomVehicle);
  const overrideBuiltinVehicle = usePresetsStore((s) => s.overrideBuiltinVehicle);
  const resetVehicle = usePresetsStore((s) => s.resetVehicle);

  const vehicleId = useLayoutStore((s) => s.vehicleId);
  const setVehicle = useLayoutStore((s) => s.setVehicle);

  const open = dialogOpen && dialog?.kind === "vehiclePreset";
  const presetId = dialog?.kind === "vehiclePreset" ? dialog.presetId : undefined;
  const isBuiltin = !!presetId && !customVehicles.some((v) => v.id === presetId);
  const overridden = !!presetId && !!vehicleOverrides[presetId];

  const initial = useMemo<VehicleFormValues>(() => {
    if (presetId) {
      const v = vehicles.find((x) => x.id === presetId);
      if (v) {
        const { id: _id, builtin: _b, ...rest } = v;
        void _id;
        void _b;
        return rest as VehicleFormValues;
      }
    }
    return makeDefault(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- сброс формы по ключу открытия
  }, [presetId, vehicles]);

  const resolver = useMemo(() => resolverFor(t), [t]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<VehicleFormValues>({ resolver, defaultValues: makeDefault(t) });

  useEffect(() => {
    if (open) reset(initial);
  }, [open, initial, reset]);

  const axleLayout = watch("axleLayout");
  const loadingSides = watch("loadingSides");
  const defaultSide = watch("defaultLoadingSide");
  const axles = watch("axles");

  const shareSum = axles.reduce(
    (s, a) => s + (Number.isFinite(a.tareShare) ? a.tareShare : 0),
    0
  );
  const shareOk = axles.length === 0 || Math.abs(shareSum - 1) <= 0.02;

  const err = (key: keyof VehicleFormValues) => msg(errors[key]);
  const axleRootError = msg(errors.axles as unknown);
  const axleRowErrors = errors.axles as unknown as (AxleRowErrors | undefined)[] | undefined;

  const toggleSide = (side: LoadingSide) => {
    const cur = getValues("loadingSides");
    const next = cur.includes(side) ? cur.filter((s) => s !== side) : [...cur, side];
    if (next.length === 0) return; // как минимум одна сторона остаётся всегда
    setValue("loadingSides", next, { shouldDirty: true });
    if (!next.includes(getValues("defaultLoadingSide"))) {
      setValue("defaultLoadingSide", next[0], { shouldDirty: true });
    }
  };

  const addAxle = () => {
    const cur = getValues("axles");
    const n = cur.length + 1;
    const next = evenShares([
      ...cur,
      {
        id: `axle.${Date.now().toString(36)}`,
        label: t("vehicle.axle.n", { n }),
        position: 0,
        maxLoad: 1000,
        tareShare: 0,
      },
    ]);
    setValue("axles", next, { shouldDirty: true });
  };

  const removeAxle = (idx: number) => {
    const cur = getValues("axles");
    setValue("axles", evenShares(cur.filter((_, i) => i !== idx)), { shouldDirty: true });
  };

  const onSubmit = handleSubmit((values) => {
    let savedId = presetId;
    if (presetId && isBuiltin) {
      overrideBuiltinVehicle(presetId, { ...values });
      toast(t("toast.vehicleSaved"));
    } else {
      savedId = upsertCustomVehicle({ ...(presetId ? { id: presetId } : {}), ...values });
      toast(t("toast.vehicleSaved"));
    }
    if (savedId && (!presetId || savedId === vehicleId)) {
      // новый авто — сразу выбираем; изменённый активный — полная пересборка
      setVehicle(savedId);
    }
    closeDialog();
  });

  const title = presetId ? t("vehicle.form.title.edit") : t("vehicle.form.title.new");

  return (
    <Dialog open={!!open} onOpenChange={(v) => !v && closeDialog()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid gap-4">
          {/* название / тип кузова */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="v-name">{t("vehicle.field.name")}</Label>
              <Input id="v-name" autoComplete="off" {...register("name")} />
              {err("name") && <FieldError text={err("name")!} />}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="v-body">{t("vehicle.field.bodyType")}</Label>
              <Input id="v-body" autoComplete="off" {...register("bodyType")} />
              {err("bodyType") && <FieldError text={err("bodyType")!} />}
            </div>
          </div>

          {/* габариты */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NumField
              label={`${t("vehicle.field.length")}, мм`}
              id="v-l"
              error={err("innerLength")}
              register={register("innerLength", { valueAsNumber: true })}
            />
            <NumField
              label={`${t("vehicle.field.width")}, мм`}
              id="v-w"
              error={err("innerWidth")}
              register={register("innerWidth", { valueAsNumber: true })}
            />
            <NumField
              label={`${t("vehicle.field.height")}, мм`}
              id="v-h"
              error={err("innerHeight")}
              register={register("innerHeight", { valueAsNumber: true })}
            />
            <NumField
              label={`${t("vehicle.field.payload")}, кг`}
              id="v-p"
              error={err("payload")}
              register={register("payload", { valueAsNumber: true })}
            />
          </div>

          {/* снаряжённая масса + схема */}
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
            <NumField
              label={`${t("vehicle.field.tare")}, кг`}
              id="v-tare"
              error={err("tare")}
              register={register("tare", { valueAsNumber: true })}
            />
            <div className="grid gap-1.5">
              <Label>{t("vehicle.axleLayout")}</Label>
              <Segmented<AxleLayout>
                id="axle-layout"
                value={axleLayout}
                onChange={(v) => setValue("axleLayout", v, { shouldDirty: true })}
                ariaLabel={t("vehicle.axleLayout")}
                className="w-full [&>button]:flex-1"
                options={[
                  { value: "rigid", label: t("vehicle.axleLayout.rigid"), icon: Truck },
                  {
                    value: "tractor-semi",
                    label: t("vehicle.axleLayout.tractor-semi"),
                    icon: Container,
                  },
                ]}
              />
            </div>
          </div>

          {/* стороны загрузки */}
          <div className="grid gap-1.5">
            <Label>{t("vehicle.loadingSides")}</Label>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-panel-soft/60 px-3 py-2.5">
              {SIDES.map((side) => (
                <label
                  key={side}
                  className="flex cursor-pointer items-center gap-2 text-[13px] text-fg-2"
                >
                  <Checkbox
                    checked={loadingSides.includes(side)}
                    onCheckedChange={() => toggleSide(side)}
                  />
                  {t(`loading.${side}`)}
                </label>
              ))}
              <span className="ml-auto flex items-center gap-2 text-[12px] text-muted">
                {t("vehicle.defaultSide")}
                <Select
                  value={defaultSide}
                  onValueChange={(v) =>
                    setValue("defaultLoadingSide", v as LoadingSide, { shouldDirty: true })
                  }
                >
                  <SelectTrigger
                    className="h-8 w-[130px] text-xs"
                    aria-label={t("vehicle.defaultSide")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingSides.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`loading.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </span>
            </div>
            {err("loadingSides") && <FieldError text={err("loadingSides")!} />}
            {err("defaultLoadingSide") && <FieldError text={err("defaultLoadingSide")!} />}
          </div>

          {/* оси */}
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label>{t("vehicle.axles")}</Label>
              <div className="flex items-center gap-2">
                {axles.length > 0 && (
                  <span
                    className={`tnum rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                      shareOk ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                    }`}
                    title={t("vehicle.axles.hint")}
                  >
                    Σ {roundTo(shareSum, 3)}
                  </span>
                )}
                <Button type="button" variant="outline" size="sm" onClick={addAxle}>
                  <Plus className="size-3.5" />
                  {t("vehicle.axle.add")}
                </Button>
              </div>
            </div>
            <p className="text-[11.5px] leading-snug text-muted">{t("vehicle.axles.hint")}</p>

            {axles.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border-strong/70 px-3 py-3 text-center text-[12.5px] text-muted">
                {t("vehicle.axles.empty")}
              </p>
            ) : (
              <ul className="grid gap-1.5">
                {axles.map((axle, i) => {
                  const rowErr = axleRowErrors?.[i];
                  return (
                    <li
                      key={axle.id}
                      className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr_auto] items-end gap-2 rounded-xl border border-border bg-panel-soft/60 p-2.5"
                    >
                      <div className="grid gap-1">
                        <Label htmlFor={`ax-l-${i}`} className="text-[11px] text-muted">
                          {t("vehicle.axle.label")}
                        </Label>
                        <Input
                          id={`ax-l-${i}`}
                          className="h-8 text-[13px]"
                          {...register(`axles.${i}.label` as const)}
                        />
                        {rowErr?.label?.message && <FieldError text={rowErr.label.message} />}
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor={`ax-p-${i}`} className="text-[11px] text-muted">
                          {t("vehicle.axle.position")}
                        </Label>
                        <Input
                          id={`ax-p-${i}`}
                          type="number"
                          inputMode="numeric"
                          className="h-8 tnum text-[13px]"
                          {...register(`axles.${i}.position` as const, { valueAsNumber: true })}
                        />
                        {rowErr?.position?.message && (
                          <FieldError text={rowErr.position.message} />
                        )}
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor={`ax-m-${i}`} className="text-[11px] text-muted">
                          {t("vehicle.axle.maxLoad")}
                        </Label>
                        <Input
                          id={`ax-m-${i}`}
                          type="number"
                          inputMode="numeric"
                          className="h-8 tnum text-[13px]"
                          {...register(`axles.${i}.maxLoad` as const, { valueAsNumber: true })}
                        />
                        {rowErr?.maxLoad?.message && (
                          <FieldError text={rowErr.maxLoad.message} />
                        )}
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor={`ax-s-${i}`} className="text-[11px] text-muted">
                          {t("vehicle.axle.tareShare")}
                        </Label>
                        <Input
                          id={`ax-s-${i}`}
                          type="number"
                          step="0.001"
                          inputMode="decimal"
                          className="h-8 tnum text-[13px]"
                          {...register(`axles.${i}.tareShare` as const, { valueAsNumber: true })}
                        />
                        {rowErr?.tareShare?.message && (
                          <FieldError text={rowErr.tareShare.message} />
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="mb-0.5 hover:text-danger"
                        aria-label={t("vehicle.axle.remove")}
                        onClick={() => removeAxle(i)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            {axleRootError && <FieldError text={axleRootError} />}
          </div>

          <DialogFooter className="flex-wrap items-center gap-2 sm:justify-between">
            <div className="flex items-center gap-2">
              {presetId && isBuiltin && overridden && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    resetVehicle(presetId);
                    toast(t("toast.vehicleReset"));
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
              <Button type="submit">{t("action.save")}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ text }: { text: string }) {
  return <p className="text-[11.5px] leading-snug text-danger">{text}</p>;
}

function NumField({
  label,
  id,
  error,
  register,
}: {
  label: string;
  id: string;
  error?: string;
  register: ReturnType<ReturnType<typeof useForm<VehicleFormValues>>["register"]>;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" inputMode="decimal" className="tnum" {...register} />
      {error && <FieldError text={error} />}
    </div>
  );
}
