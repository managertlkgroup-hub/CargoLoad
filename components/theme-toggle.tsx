"use client";

import { useHydrated, useTheme } from "@teispace/next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/use-t";

/** Мгновенное переключение тем без гидрационных ошибок. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const t = useT();

  if (!hydrated) {
    return <Button variant="ghost" size="icon" aria-label={t("theme.toggle")} className="opacity-0" />;
  }

  const isDark = resolvedTheme !== "light";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? t("theme.toLight") : t("theme.toDark")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative overflow-hidden"
    >
      <Sun
        className={`size-4 transition-all duration-300 ${isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
      />
      <Moon
        className={`absolute size-4 transition-all duration-300 ${isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`}
      />
    </Button>
  );
}
