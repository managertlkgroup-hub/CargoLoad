import type { LengthUnit, Locale, WeightUnit } from "@/types";

/**
 * Округление на границе вычисления — защита от «мусорных» чисел
 * (3282.6956576032567) в метриках и счётчиках.
 */
export function roundTo(value: number, digits: number): number {
  if (!Number.isFinite(value)) return 0;
  const f = 10 ** digits;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** Точность отображения длины по единицам. */
export const LENGTH_PRECISION: Record<LengthUnit, number> = { mm: 0, cm: 1, m: 2 };

/** Точность отображения веса по единицам. */
export const WEIGHT_PRECISION: Record<WeightUnit, number> = { kg: 0, t: 2 };

/** Подпись единицы длины («мм»/«см»/«м» — ru, «mm»/«cm»/«m» — en). */
export function lengthUnitLabel(unit: LengthUnit, locale: Locale): string {
  return locale === "ru" ? { mm: "мм", cm: "см", m: "м" }[unit] : unit;
}

/** Подпись единицы веса («кг»/«т» — ru, «kg»/«t» — en). */
export function weightUnitLabel(unit: WeightUnit, locale: Locale): string {
  return locale === "ru" ? { kg: "кг", t: "т" }[unit] : unit;
}

const LENGTH_DIVISOR: Record<LengthUnit, number> = { mm: 1, cm: 10, m: 1000 };
const WEIGHT_DIVISOR: Record<WeightUnit, number> = { kg: 1, t: 1000 };

/** мм → число в единице отображения (с округлением до точности единицы). */
export function lengthToDisplay(mm: number, unit: LengthUnit): number {
  return roundTo(mm / LENGTH_DIVISOR[unit], LENGTH_PRECISION[unit]);
}

/** число в единице отображения → мм. */
export function lengthFromDisplay(value: number, unit: LengthUnit): number {
  return roundTo(value * LENGTH_DIVISOR[unit], 3);
}

/** кг → число в единице отображения. */
export function weightToDisplay(kg: number, unit: WeightUnit): number {
  return roundTo(kg / WEIGHT_DIVISOR[unit], WEIGHT_PRECISION[unit]);
}

/** число в единице отображения → кг. */
export function weightFromDisplay(value: number, unit: WeightUnit): number {
  return roundTo(value * WEIGHT_DIVISOR[unit], 4);
}

/** Форматирование числа по локали ( RU → запятая, EN → точка ). */
export function formatNumber(value: number, digits: number, locale: Locale): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Отформатированная длина, напр. «13.6 м» / «13,6 м» (без единицы — useFormat=false). */
export function formatLength(
  mm: number,
  unit: LengthUnit,
  locale: Locale,
  withUnit = true
): string {
  const n = formatNumber(lengthToDisplay(mm, unit), LENGTH_PRECISION[unit], locale);
  if (!withUnit) return n;
  return `${n} ${lengthUnitLabel(unit, locale)}`;
}

/** Отформатированный вес: «1250 кг» / «1.25 т». */
export function formatWeight(kg: number, unit: WeightUnit, locale: Locale, withUnit = true): string {
  const n = formatNumber(weightToDisplay(kg, unit), WEIGHT_PRECISION[unit], locale);
  if (!withUnit) return n;
  return `${n} ${weightUnitLabel(unit, locale)}`;
}

/** Объём: м³ с 2 знаками. */
export function formatVolume(m3: number, locale: Locale): string {
  return formatNumber(roundTo(m3, 2), 2, locale);
}
