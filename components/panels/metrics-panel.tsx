"use client";

import { motion } from "framer-motion";
import {
  Box,
  Boxes,
  CircleAlert,
  Gauge,
  LayoutGrid,
  Scale,
  Truck,
} from "lucide-react";

import { AnimatedNumber } from "@/components/panels/animated-number";
import { useUiStore } from "@/store/use-ui-store";
import { useLayoutStore } from "@/store/use-layout-store";
import { useT } from "@/hooks/use-t";
import { useVehicle } from "@/hooks/use-vehicle";
import { recommendVehicleCount } from "@/lib/advanced/vehicle-selector";
import { cn } from "@/lib/utils";
import {
  formatLength,
  formatNumber,
  formatVolume,
  formatWeight,
  weightUnitLabel,
} from "@/lib/units";
import { Badge } from "@/components/ui/badge";
import type { LoadMetrics } from "@/types";

const COG_LEVEL_KEYS: Record<LoadMetrics["cog"]["level"], string> = {
  ok: "metric.cog.ok",
  warn: "metric.cog.warn",
  crit: "metric.cog.crit",
};

const COG_LEVEL_VARIANT: Record<LoadMetrics["cog"]["level"], "success" | "warning" | "danger"> = {
  ok: "success",
  warn: "warning",
  crit: "danger",
};

export function MetricsPanel({ metrics }: { metrics: LoadMetrics }) {
  const t = useT();
  const locale = useUiStore((s) => s.locale);
  const lengthUnit = useUiStore((s) => s.lengthUnit);
  const weightUnit = useUiStore((s) => s.weightUnit);
  const vehicle = useVehicle();
  const items = useLayoutStore((s) => s.items);
  const fleet = items.length ? recommendVehicleCount(items, vehicle) : null;

  const lenFmt = (v: number) => formatLength(v, lengthUnit, locale);
  const pctFmt = (v: number) => `${formatNumber(v, 1, locale)} %`;

  const bboxNo = metrics.bboxNoGaps;
  const bboxWith = metrics.bboxWithGaps;
  const cog = metrics.cog;

  return (
    <div className="space-y-3">
      <Meter
        icon={<Box className="size-4 text-primary" />}
        label={t("metric.volume")}
        pct={metrics.volumePct}
        pctFmt={pctFmt}
        gradient="from-primary to-accent"
        detail={`${formatVolume(metrics.volumeUsedM3, locale)} / ${formatVolume(metrics.volumeTotalM3, locale)} м³`}
      />
      <Meter
        icon={<Scale className="size-4 text-accent" />}
        label={t("metric.weight")}
        pct={metrics.weightPct}
        pctFmt={pctFmt}
        gradient="from-accent to-primary"
        detail={`${formatWeight(metrics.weightUsedKg, weightUnit, locale)} / ${formatWeight(metrics.weightCapacityKg, weightUnit, locale)}`}
      />

      {/* размещено/всего + свободный ресурс */}
      <Card>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">{t("metric.placed")}</span>
          <span className="tnum text-sm font-semibold text-fg">
            <AnimatedNumber
              value={metrics.placedCount}
              format={(v) => formatNumber(v, 0, locale)}
            />{" "}
            {t("metric.of")}{" "}
            <AnimatedNumber
              value={metrics.totalCount}
              format={(v) => formatNumber(v, 0, locale)}
            />
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11.5px]">
          <span className="text-muted">
            {t("metric.free")} · {t("metric.volume")}
          </span>
          <span className="tnum text-fg-2">
            <AnimatedNumber
              value={metrics.volumeFreeM3}
              format={(v) => formatVolume(v, locale)}
            />{" "}
            м³
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11.5px]">
          <span className="text-muted">
            {t("metric.free")} · {t("metric.weight")}
          </span>
          <span className="tnum text-fg-2">
            <AnimatedNumber
              value={metrics.weightFreeKg}
              format={(v) => `${formatWeight(v, weightUnit, locale)}`}
            />
          </span>
        </div>
        {fleet && (
          <div className="mt-1.5 flex items-center justify-between border-t border-border/60 pt-1.5 text-[11.5px]">
            <span className="text-muted">{t("metric.vehicles")}</span>
            <span className="tnum font-semibold text-primary">
              <AnimatedNumber value={fleet.count} format={(v) => formatNumber(v, 0, locale)} />
            </span>
          </div>
        )}
      </Card>

      {/* габариты укладки */}
      <Card>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-fg-2">
          <LayoutGrid className="size-3.5 text-accent" />
          {t("metric.bbox")}
        </div>
        <div className="space-y-1">
          <BBoxRow label={t("metric.bboxNoGaps")} b={bboxNo} fmt={lenFmt} />
          <BBoxRow label={t("metric.bboxWithGaps")} b={bboxWith} fmt={lenFmt} />
        </div>
      </Card>

      {/* слои + LDM */}
      <Card>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-fg-2">
            <Boxes className="size-3.5 text-primary" />
            {t("metric.layers")}
          </div>
          <Badge variant={metrics.canStack ? "success" : "muted"}>
            {metrics.canStack ? t("metric.canStack") : t("metric.noStack")}
          </Badge>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11.5px]">
          <span className="text-muted">{t("metric.maxLayers")}</span>
          <span className="tnum text-fg-2">
            <AnimatedNumber value={metrics.maxLayers} format={(v) => formatNumber(v, 0, locale)} />
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11.5px]">
          <span className="text-muted">{t("stack.currentLayers")}</span>
          <span className="tnum text-fg-2">
            <AnimatedNumber value={metrics.currentLayers} format={(v) => formatNumber(v, 0, locale)} />
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11.5px]">
          <span className="text-muted">{t("metric.floorArea")}</span>
          <span className="tnum text-fg-2">
            <AnimatedNumber value={metrics.floorAreaM2} format={(v) => formatNumber(v, 2, locale)} /> м²
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11.5px]">
          <span className="text-muted">{t("metric.ldm")}</span>
          <span className="tnum text-fg-2">
            <AnimatedNumber value={metrics.ldm} format={(v) => formatNumber(v, 2, locale)} />
          </span>
        </div>
      </Card>

      {/* центр тяжести */}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium text-fg-2">
            <Gauge className="size-3.5 text-warning" />
            {t("metric.cog")}
          </span>
          <Badge variant={COG_LEVEL_VARIANT[cog.level]}>{t(COG_LEVEL_KEYS[cog.level])}</Badge>
        </div>
        <div className="space-y-1 text-[11.5px]">
          <CogRow label={t("metric.cog.long")} pct={cog.longitudinalPct} fmt={pctFmt} />
          <CogRow label={t("metric.cog.lat")} pct={cog.lateralPct} fmt={pctFmt} />
        </div>
      </Card>

      {/* осевые нагрузки */}
      <Card>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-fg-2">
          <Truck className="size-3.5 text-success" />
          {t("metric.axles")}
        </div>
        {!metrics.axlesAvailable || metrics.axles.length === 0 ? (
          <p className="text-[11.5px] text-muted">{t("vehicle.axles.empty")}</p>
        ) : (
          <div className="space-y-2">
            {metrics.axles.map((a) => (
              <div key={a.axleId}>
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="text-muted">{a.label}</span>
                  <span
                    className={cn(
                      "tnum font-medium",
                      a.overloaded ? "text-danger" : "text-fg-2"
                    )}
                  >
                    {formatNumber(a.pct, 1, locale)} %
                    {a.overloaded && (
                      <CircleAlert className="ml-1 inline size-3 text-danger" />
                    )}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-soft">
                    <motion.div
                      className={cn(
                        "h-full rounded-full",
                        a.overloaded
                          ? "bg-danger"
                          : a.pct > 80
                            ? "bg-warning"
                            : "bg-success"
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, a.pct)}%` }}
                      transition={{ type: "spring", stiffness: 120, damping: 22 }}
                    />
                  </div>
                  <span className="tnum shrink-0 text-[10.5px] text-muted">
                    {formatWeight(a.loadKg, weightUnit, locale, false)} /{" "}
                    {formatWeight(a.maxLoadKg, weightUnit, locale, false)} {weightUnitLabel(weightUnit, locale)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-panel-soft/60 p-3">{children}</div>;
}

function Meter({
  icon,
  label,
  pct,
  pctFmt,
  gradient,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  pct: number;
  pctFmt: (v: number) => string;
  gradient: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-panel-soft/60 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="flex items-center gap-1.5 text-xs text-muted">
          {icon}
          {label}
        </span>
        <span className="tnum text-sm font-semibold text-fg">
          <AnimatedNumber value={pct} format={pctFmt} />
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

function BBoxRow({
  label,
  b,
  fmt,
}: {
  label: string;
  b: { length: number; width: number; height: number };
  fmt: (v: number) => string;
}) {
  return (
    <div className="flex items-center justify-between text-[11.5px]">
      <span className="text-muted">{label}</span>
      <span className="tnum text-fg-2">
        {fmt(b.length)} × {fmt(b.width)} × {fmt(b.height)}
      </span>
    </div>
  );
}

function CogRow({ label, pct, fmt }: { label: string; pct: number; fmt: (v: number) => string }) {
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return (
    <div className="flex items-center justify-between text-[11.5px]">
      <span className="text-muted">{label}</span>
      <span className="tnum text-fg-2">
        {sign}
        {fmt(Math.abs(pct))}
      </span>
    </div>
  );
}