"use client";

import { ThemeProvider as TeispaceThemeProvider } from "@teispace/next-themes";
import type { ComponentProps } from "react";

/**
 * Две темы: тёмная (основная, «Obsidian Aurora») и светлая.
 * Переключение мгновенное, без гидрационных ошибок
 * (анти-FOUC скрипт инжектится провайдером до гидратации).
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof TeispaceThemeProvider>) {
  return (
    <TeispaceThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </TeispaceThemeProvider>
  );
}
