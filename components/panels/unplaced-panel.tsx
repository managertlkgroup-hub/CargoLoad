"use client";

import { CircleAlert, PackageX } from "lucide-react";

import { useT } from "@/hooks/use-t";
import { useUiStore } from "@/store/use-ui-store";
import { cn } from "@/lib/utils";
import { formatLength, formatWeight } from "@/lib/units";
import type { LoadMetrics } from "@/types";

const REASON_KEYS: Record<string, string> = {
  "no-space": "reason.no-space",
  "too-big": "reason.too-big",
  "weight-limit": "reason.weight-limit",
  "height-limit": "reason.height-limit",
};

export function UnplacedPanel({ metrics }: { metrics: LoadMetrics }) {
  const t = useT();
  const locale = useUiStore((s) => s.locale);
  const weightUnit = useUiStore((s) => s.weightUnit);

  const unplacedCount = metrics.unplaced.reduce((s, u) => s + u.quantity, 0);

  return (
    <div className="rounded-xl border border-border bg-panel-soft/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-fg-2">
          <PackageX className="size-3.5 text-warning" />
          {t("panel.unplaced")}
        </span>
        <span
          className={cn(
            "tnum text-[11px]",
            unplacedCount > 0 ? "text-warning" : "text-muted"
          )}
        >
          {unplacedCount}
        </span>
      </div>

      {metrics.unplaced.length === 0 ? (
        <p className="text-[11.5px] text-muted">
          {metrics.totalCount > 0 ? t("metric.noUnplaced") : "—"}
        </p>
      ) : (
        <>
          <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-0.5">
            {metrics.unplaced.map((u) => (
              <li
                key={u.itemId}
                className="rounded-lg border border-warning/25 bg-warning/8 px-2 py-1.5 text-[11.5px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-fg-2">{u.name}</span>
                  <span className="tnum shrink-0 text-warning">
                    ×{u.quantity} {t("cargo.qty")}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-[10.5px] text-muted">
                  <span className="truncate">
                    {formatLength(u.length, "mm", locale)} ×{" "}
                    {formatLength(u.width, "mm", locale)} ×{" "}
                    {formatLength(u.height, "mm", locale)}
                  </span>
                  <span className="tnum shrink-0">
                    {formatWeight(u.weight * u.quantity, weightUnit, locale)}
                  </span>
                </div>
                <div className="mt-0.5 text-[10.5px] text-muted">
                  {t(REASON_KEYS[u.reason] ?? "reason.no-space")}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <span>{t("panel.unplaced.hint")}</span>
          </p>
        </>
      )}
    </div>
  );
}