"use client";

import { useCallback } from "react";

import { translate } from "@/lib/i18n";
import { useUiStore } from "@/store/use-ui-store";

/** Хук перевода: const t = useT(); t("cargo.title") */
export function useT() {
  const locale = useUiStore((s) => s.locale);
  return useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale]
  );
}
