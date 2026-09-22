import { en } from "@/lib/i18n/en";
import { ru } from "@/lib/i18n/ru";
import type { Locale } from "@/types";

const dictionaries: Record<Locale, Record<string, string>> = { ru, en };

/** Перевод ключа с подстановкой {vars}. Фолбэк: ru → сам ключ. */
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>
): string {
  let out = dictionaries[locale]?.[key] ?? ru[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replaceAll(`{${k}}`, String(v));
    }
  }
  return out;
}

export const DICT_RU_KEYS = Object.keys(ru);
