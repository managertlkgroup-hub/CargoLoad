import { z } from "zod";

import { LIMITS, LIMIT_MESSAGES } from "@/lib/constants";

/** Переводчик: использовать translate(locale, key, vars). */
export type T = (key: string, vars?: Record<string, string | number>) => string;

/** Поле с лимитами: сообщение — полностью из i18n (диапазон с единицами). */
function ranged(s: T, limit: keyof typeof LIMITS, key: string) {
  const msg = s(`validation.range.${key}`);
  const { min, max } = LIMITS[limit];
  return z.number({ message: msg }).min(min, msg).max(max, msg);
}

/** Груз: все размеры в мм, вес в кг. */
export function createCargoItemSchema(s: T) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(1, s("validation.nameRequired"))
        .max(120, s("validation.nameMax", { n: 120 })),
      shape: z.enum(["box", "cylinder"]),
      length: ranged(s, "cargoLength", "cargoLength"),
      width: ranged(s, "cargoWidth", "cargoWidth"),
      height: ranged(s, "cargoHeight", "cargoHeight"),
      diameter: ranged(s, "diameter", "diameter"),
      weight: ranged(s, "weight", "weight"),
      quantity: z
        .number({ message: s("validation.quantityInt") })
        .int(s("validation.quantityInt"))
        .min(
          LIMITS.quantity.min,
          s("validation.quantityRange", { min: LIMITS.quantity.min, max: LIMITS.quantity.max })
        )
        .max(
          LIMITS.quantity.max,
          s("validation.quantityRange", { min: LIMITS.quantity.min, max: LIMITS.quantity.max })
        ),
      stackable: z.boolean(),
      maxTopLoad: ranged(s, "maxTopLoad", "maxTopLoad"),
      group: z.string().trim().min(1, s("validation.groupRequired")).max(40),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/, s("validation.colorFormat")),
      cylinderAxis: z.enum(["up", "side"]),
      stopIndex: z.number().int().min(0).max(99),
      isOversize: z.boolean().optional().default(false),
    })
    .superRefine((v, ctx) => {
      if (v.shape === "cylinder" && v.diameter < LIMITS.diameter.min) {
        ctx.addIssue({
          code: "custom",
          path: ["diameter"],
          message: s("validation.cylinderMin", { n: LIMITS.diameter.min }),
        });
      }
      if (v.stackable && v.maxTopLoad <= 0) {
        ctx.addIssue({ code: "custom", path: ["maxTopLoad"], message: s("validation.stackLoadRequired") });
      }
      if (!v.stackable && v.maxTopLoad > 0) {
        ctx.addIssue({ code: "custom", path: ["stackable"], message: s("validation.stackConflict") });
      }
    });
}

export type CargoItemInput = z.input<ReturnType<typeof createCargoItemSchema>>;

/** Автомобиль: размеры в мм, вес в кг. */
export function createAxleSchema(s: T) {
  return z.object({
    id: z.string().min(1),
    label: z.string().trim().min(1, s("validation.axleNameRequired")).max(40),
    position: z.number().min(-20000, s("validation.axlePosRange")).max(80000),
    maxLoad: z.number().min(100, s("validation.axleLoadRange")).max(50000),
    tareShare: z.number().min(0, s("validation.tareShareRange")).max(1),
  });
}

export function createVehicleSchema(s: T) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(1, s("validation.nameRequired"))
        .max(80, s("validation.nameMax", { n: 80 })),
      nameEn: z.string().trim().max(80, s("validation.nameMax", { n: 80 })).optional().default(""),
      innerLength: ranged(s, "vehicleLength", "vehicleLength"),
      innerWidth: ranged(s, "vehicleWidth", "vehicleWidth"),
      innerHeight: ranged(s, "vehicleHeight", "vehicleHeight"),
      payload: ranged(s, "payload", "payload"),
      tare: z.number().min(0, s("validation.tareRange")).max(100000),
      axleLayout: z.enum(["rigid", "tractor-semi"]),
      axles: z.array(createAxleSchema(s)).max(8, s("validation.axlesMax")),
      loadingSides: z
        .array(z.enum(["rear", "right", "left", "top"]))
        .min(1, s("validation.loadingSidesMin")),
      defaultLoadingSide: z.enum(["rear", "right", "left", "top"]),
      bodyType: z.string().trim().max(60).optional().default(""),
    })
    .superRefine((v, ctx) => {
      if (!v.loadingSides.includes(v.defaultLoadingSide)) {
        ctx.addIssue({
          code: "custom",
          path: ["defaultLoadingSide"],
          message: s("validation.defaultSide"),
        });
      }
      const sum = v.axles.reduce((s2, a) => s2 + a.tareShare, 0);
      if (v.axles.length > 0 && Math.abs(sum - 1) > 0.02) {
        ctx.addIssue({
          code: "custom",
          path: ["axles"],
          message: s("validation.tareShareSum"),
        });
      }
    });
}

export type VehicleInput = z.input<ReturnType<typeof createVehicleSchema>>;

/** Зазоры (per-mode). Пустое поле → 0 (обрабатывается в форме). */
export const gapsSchema = z.object({
  wall: z.number({ message: LIMIT_MESSAGES.gaps }).min(LIMITS.gaps.min).max(LIMITS.gaps.max),
  rowWidth: z.number({ message: LIMIT_MESSAGES.gaps }).min(LIMITS.gaps.min).max(LIMITS.gaps.max),
  rowLength: z.number({ message: LIMIT_MESSAGES.gaps }).min(LIMITS.gaps.min).max(LIMITS.gaps.max),
});

export type GapsInput = z.input<typeof gapsSchema>;

/** Название сессии. */
export function createSessionNameSchema(s: T) {
  return z
    .string()
    .trim()
    .min(1, s("validation.sessionName"))
    .max(60, s("validation.sessionNameMax"));
}

/** Строка импорта Excel/CSV. */
export function createImportRowSchema(s: T) {
  return z.object({
    name: z.string().trim().min(1, s("validation.importName")),
    shape: z.enum(["box", "cylinder"]),
    length: ranged(s, "cargoLength", "cargoLength"),
    width: ranged(s, "cargoWidth", "cargoWidth"),
    height: ranged(s, "cargoHeight", "cargoHeight"),
    diameter: ranged(s, "diameter", "diameter"),
    weight: ranged(s, "weight", "weight"),
    quantity: z.number().int().min(1).max(10000),
    stackable: z.boolean(),
    group: z.string().min(1),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    isOversize: z.boolean().optional().default(false),
  });
}

export type ImportRow = z.input<ReturnType<typeof createImportRowSchema>>;

/**
 * Валидация с откатом: применяет схему, возвращает либо данные,
 * либо первую ошибку для тоста.
 */
export function validateOrError<T extends z.ZodType>(
  schema: T,
  data: unknown
): { ok: true; data: z.output<T> } | { ok: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  const first = result.error.issues[0];
  return { ok: false, error: first?.message ?? "" };
}