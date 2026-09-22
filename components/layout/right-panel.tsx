"use client";

import { motion } from "framer-motion";
import { CircleAlert, Loader2, PackageCheck, PackageX, X } from "lucide-react";

import { useT } from "@/hooks/use-t";
import { useVehicle } from "@/hooks/use-vehicle";
import { unitVolume } from "@/lib/geometry";
import { formatNumber, formatVolume, formatWeight, roundTo } from "@/lib/units";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/store/use-layout-store";
import { useUiStore } from "@/store/use-ui-store";
import { Badge } from "@/components/ui/badge";

const REASON_KEYS: Record<string, string> = {
  "no-space": "reason.no-space",
  "too-big": "reason.too-big",
  "weight-limit": "reason.weight-limit",
  "height-limit": "reason.height-limit",
};

export function RightPanel({ onClose }: { onClose?: () => void }) {
  const t = useT();
  const locale = useUiStore((s) => s.locale);
  const weightUnit = useUiStore((s) => s.weightUnit);

  const items = useLayoutStore((s) => s.items);
  const placements = useLayoutStore((s) => s.placements);
  const unplaced = useLayoutStore((s) => s.unplaced);
  const packStatus = useLayoutStore((s) => s.packStatus);
  const lastPackMs = useLayoutStore((s) => s.lastPackMs);
  const vehicle = useVehicle();

  const itemById = new Map(items.map((i) => [i.id, i]));

  // базовые метрики (полные — с LDM/COG/осевыми — в панели Группы 8)
  const volumeTotalM3 = (vehicle.innerLength * vehicle.innerWidth * vehicle.innerHeight) / 1e9;
  const volumeUsedM3 =
    placements.reduce((sum, p) => {
      const item = itemById.get(p.itemId);
      return sum + (item ? unitVolume(item) / 1e9 : 0);
    }, 0);
  const weightUsedKg = placements.reduce((sum, p) => {
    const item = itemById.get(p.itemId);
    return sum + (item ? item.weight : 0);
  }, 0);

  const volumePct = roundTo(
    volumeTotalM3 > 0 ? (volumeUsedM3 / volumeTotalM3) * 100 : 0,
    1
  );
  const weightPct = roundTo(
    vehicle.payload > 0 ? (weightUsedKg / vehicle.payload) * 100 : 0,
    1
  );
  const totalCount = items.reduce((s, i) => s + i.quantity, 0);
  const unplacedCount = unplaced.reduce((s, u) => s + u.quantity, 0);
  const placedCount = placements.length;

  return (
    <aside className="glass flex h-full min-h-0 w-full flex-col rounded-2xl lg:w-[320px]">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <PackageCheck className="size-4 text-accent" />
          <span className="panel-label">{t("panel.metrics")}</span>
        </div>
        <div className="flex items-center gap-2">
          {packStatus === "packing" ? (
            <Badge variant="muted">
              <Loader2 className="size-3 animate-spin" />
              {t("status.packing")}
            </Badge>
          ) : (
            <Badge variant="accent">
              <span className="tnum">{formatNumber(lastPackMs, 0, locale)}</span>
              {t("status.ms")}
            </Badge>
          )}
          {onClose && (
            <button
              type="button"
              className="rounded-lg p-1 text-muted hover:bg-panel-soft hover:text-fg lg:hidden"
              onClick={onClose}
              aria-label={t("action.close")}
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <Meter
          label={t("metric.volume")}
          pct={volumePct}
          gradient="from-primary to-accent"
          detail={`${formatVolume(volumeUsedM3, locale)} / ${formatVolume(volumeTotalM3, locale)} м³`}
          locale={locale}
        />
        <Meter
          label={t("metric.weight")}
          pct={weightPct}
          gradient="from-accent to-primary"
          detail={`${formatWeight(weightUsedKg, weightUnit, locale)} / ${formatWeight(vehicle.payload, weightUnit, locale)}`}
          locale={locale}
        />

        {/* размещено/всего + свободный ресурс */}
        <div className="rounded-xl border border-border bg-panel-soft/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">{t("metric.placed")}</span>
            <span className="tnum font-semibold text-fg">
              {placedCount} {t("metric.of")} {totalCount}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11.5px]">
            <span className="text-muted">
              {t("metric.free")} · {t("metric.volume")}
            </span>
            <span className="tnum text-fg-2">
              {formatVolume(Math.max(0, volumeTotalM3 - volumeUsedM3), locale)} м³
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11.5px]">
            <span className="text-muted">
              {t("metric.free")} · {t("metric.weight")}
            </span>
            <span className="tnum text-fg-2">
              {formatWeight(Math.max(0, vehicle.payload - weightUsedKg), weightUnit, locale)}
            </span>
          </div>
        </div>

        {/* неразмещённые */}
        <div className="rounded-xl border border-border bg-panel-soft/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-fg-2">
              <PackageX className="size-3.5 text-warning" />
              {t("panel.unplaced")}
            </span>
            <span className={cn("tnum text-[11px]", unplacedCount > 0 ? "text-warning" : "text-muted")}>
              {unplacedCount}
            </span>
          </div>
          {unplaced.length === 0 ? (
            <p className="text-[11.5px] text-muted">
              {totalCount > 0 ? t("metric.noUnplaced") : "—"}
            </p>
          ) : (
            <ul className="max-h-44 space-y-1.5 overflow-y-auto">
              {unplaced.map((u) => {
                const item = itemById.get(u.itemId);
                if (!item) return null;
                return (
                  <li
                    key={`${u.itemId}-${u.reason}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-warning/25 bg-warning/8 px-2 py-1.5 text-[11.5px]"
                  >
                    <span className="truncate text-fg-2">{item.name}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="tnum text-warning">
                        ×{u.quantity} {t("cargo.qty")}
                      </span>
                      <span className="hidden text-muted xl:inline">
                        {t(REASON_KEYS[u.reason] ?? "reason.no-space")}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {unplacedCount > 0 && (
          <p className="flex items-start gap-1.5 text-[11px] text-muted">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <span>{t("panel.unplaced.hint")}</span>
          </p>
        )}
      </div>
    </aside>
  );
}

function Meter({
  label,
  pct,
  gradient,
  detail,
  locale,
}: {
  label: string;
  pct: number;
  gradient: string;
  detail: string;
  locale: "ru" | "en";
}) {
  return (
    <div className="rounded-xl border border-border bg-panel-soft/60 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs text-muted">{label}</span>
        <span className="tnum text-sm font-semibold text-fg">
          {formatNumber(pct, 1, locale)} %
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-panel-soft">
        <motion.div
          className={cn("h-full rounded-full bg-gradient-to-r", gradient)}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, pct)}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
        />
      </div>
      <div className="tnum mt-1.5 text-[11px] text-muted">{detail}</div>
    </div>
  );
}
