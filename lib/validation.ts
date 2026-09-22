import { z } from "zod";

import { LIMITS, LIMIT_MESSAGES } from "@/lib/constants";

const range = (r: { min: number; max: number }, message: string) =>
  z
    .number({ message })
    .min(r.min, `${message}: минимум ${r.min}`)
    .max(r.max, `${message}: максимум ${r.max}`);

/** Груз: все размеры в мм, вес в кг. */
export const cargoItemSchema = z
  .object({
    name: z.string().trim().min(1, "Укажите название").max(120, "Максимум 120 символов"),
    shape: z.enum(["box", "cylinder", "oversize"]),
    length: range(LIMITS.cargoLength, LIMIT_MESSAGES.cargoLength),
    width: range(LIMITS.cargoWidth, LIMIT_MESSAGES.cargoWidth),
    height: range(LIMITS.cargoHeight, LIMIT_MESSAGES.cargoHeight),
    diameter: range(LIMITS.diameter, LIMIT_MESSAGES.diameter),
    weight: range(LIMITS.weight, LIMIT_MESSAGES.weight),
    quantity: z
      .number({ message: LIMIT_MESSAGES.quantity })
      .int("Количество — целое число")
      .min(LIMITS.quantity.min, `Количество: ${LIMITS.quantity.min}–${LIMITS.quantity.max}`)
      .max(LIMITS.quantity.max, `Количество: ${LIMITS.quantity.min}–${LIMITS.quantity.max}`),
    stackable: z.boolean(),
    maxTopLoad: range(LIMITS.maxTopLoad, LIMIT_MESSAGES.maxTopLoad),
    group: z.string().trim().min(1, "Укажите группу совместимости").max(40),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Цвет в формате #RRGGBB"),
    cylinderAxis: z.enum(["up", "side"]),
    stopIndex: z.number().int().min(0).max(99),
  })
  .superRefine((v, ctx) => {
    if (v.shape === "cylinder" && v.diameter < LIMITS.diameter.min) {
      ctx.addIssue({
        code: "custom",
        path: ["diameter"],
        message: `Диаметр: минимум ${LIMITS.diameter.min} мм`,
      });
    }
    if (v.stackable && v.maxTopLoad <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["maxTopLoad"],
        message: "Штабелируемый груз должен выдерживать нагрузку сверху (> 0 кг)",
      });
    }
    if (!v.stackable && v.maxTopLoad > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["stackable"],
        message: "Нагрузка сверху указана, но груз помечен как нештабелируемый",
      });
    }
  });

export type CargoItemInput = z.input<typeof cargoItemSchema>;

/** Автомобиль: размеры в мм, вес в кг. */
export const axleSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1, "Укажите название оси").max(40),
  position: z.number().min(-20000, "Позиция: -20000…80000 мм").max(80000),
  maxLoad: z.number().min(100, "Допуск оси: 100–50000 кг").max(50000),
  tareShare: z.number().min(0, "Доля снаряжённой массы: 0–1").max(1),
});

export const vehicleSchema = z
  .object({
    name: z.string().trim().min(1, "Укажите название").max(80, "Максимум 80 символов"),
    nameEn: z.string().trim().max(80).optional().default(""),
    innerLength: range(LIMITS.vehicleLength, LIMIT_MESSAGES.vehicleLength),
    innerWidth: range(LIMITS.vehicleWidth, LIMIT_MESSAGES.vehicleWidth),
    innerHeight: range(LIMITS.vehicleHeight, LIMIT_MESSAGES.vehicleHeight),
    payload: range(LIMITS.payload, LIMIT_MESSAGES.payload),
    tare: z.number().min(0, "Снаряжённая масса: 0–100000 кг").max(100000),
    axleLayout: z.enum(["rigid", "tractor-semi"]),
    axles: z.array(axleSchema).max(8, "Не более 8 осей"),
    loadingSides: z
      .array(z.enum(["rear", "right", "left", "top"]))
      .min(1, "Выберите хотя бы одну сторону загрузки"),
    defaultLoadingSide: z.enum(["rear", "right", "left", "top"]),
    bodyType: z.string().trim().max(60).optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (!v.loadingSides.includes(v.defaultLoadingSide)) {
      ctx.addIssue({
        code: "custom",
        path: ["defaultLoadingSide"],
        message: "Сторона по умолчанию должна быть среди доступных",
      });
    }
    const sum = v.axles.reduce((s, a) => s + a.tareShare, 0);
    if (v.axles.length > 0 && Math.abs(sum - 1) > 0.02) {
      ctx.addIssue({
        code: "custom",
        path: ["axles"],
        message: "Сумма долей снаряжённой массы по осям должна быть равна 1",
      });
    }
  });

export type VehicleInput = z.input<typeof vehicleSchema>;

/** Зазоры (per-mode). Пустое поле → 0 (обрабатывается в форме). */
export const gapsSchema = z.object({
  wall: range(LIMITS.gaps, LIMIT_MESSAGES.gaps),
  rowWidth: range(LIMITS.gaps, LIMIT_MESSAGES.gaps),
  rowLength: range(LIMITS.gaps, LIMIT_MESSAGES.gaps),
});

export type GapsInput = z.input<typeof gapsSchema>;

/** Название сессии. */
export const sessionNameSchema = z
  .string()
  .trim()
  .min(1, "Укажите название сессии")
  .max(60, "Максимум 60 символов");

/** Строка импорта Excel/CSV. */
export const importRowSchema = z.object({
  name: z.string().trim().min(1, "нет названия"),
  shape: z.enum(["box", "cylinder", "oversize"]),
  length: range(LIMITS.cargoLength, LIMIT_MESSAGES.cargoLength),
  width: range(LIMITS.cargoWidth, LIMIT_MESSAGES.cargoWidth),
  height: range(LIMITS.cargoHeight, LIMIT_MESSAGES.cargoHeight),
  diameter: range(LIMITS.diameter, LIMIT_MESSAGES.diameter),
  weight: range(LIMITS.weight, LIMIT_MESSAGES.weight),
  quantity: z.number().int().min(1).max(10000),
  stackable: z.boolean(),
  group: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export type ImportRow = z.input<typeof importRowSchema>;

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
  return { ok: false, error: first?.message ?? "Некорректные данные" };
}
