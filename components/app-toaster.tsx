"use client";

import { useTheme } from "@teispace/next-themes";
import { Toaster } from "sonner";

export function AppToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="bottom-right"
      offset={16}
      gap={10}
      theme={resolvedTheme === "light" ? "light" : "dark"}
      toastOptions={{
        style: {
          background: "var(--panel-strong)",
          color: "var(--fg)",
          border: "1px solid var(--border-strong)",
          borderRadius: "14px",
          backdropFilter: "blur(26px) saturate(1.6)",
          WebkitBackdropFilter: "blur(26px) saturate(1.6)",
          boxShadow: "var(--shadow-2)",
          fontFamily: "inherit",
          fontSize: "13.5px",
        },
      }}
    />
  );
}
