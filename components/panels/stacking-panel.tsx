"use client";

import { Blocks, Layers, LifeBuoy, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useT } from "@/hooks/use-t";
import { useVehicle } from "@/hooks/use-vehicle";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/store/use-layout-store";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import type { LoadMetrics } from "@/types";

const MAX_CAP = 100;

export function StackingPanel({ metrics }: { metrics: LoadMetrics | null }) {
  const t = useT();
  const stacking = useLayoutStore((s) => s.stacking);
  const setStacking = useLayoutStore((s) => s.setStacking);
  const lifo = useLayoutStore((s) => s.lifo);
  const setLifo = useLayoutStore((s) => s.setLifo);
  const maxLayers = useLayoutStore((s) => s.maxLayers);
  const setMaxLayers = useLayoutStore((s) => s.setMaxLayers);
  const vehicle = useVehicle();

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-panel-soft/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-fg-2">
            <Blocks className="size-3.5 text-primary" />
            {t("stack.enabled")}
          </span>
          <Switch checked={stacking} onCheckedChange={setStacking} aria-label={t("stack.enabled")} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-fg-2">
            <Layers className="size-3.5 text-accent" />
            {t("stack.lifo")}
          </span>
          <Switch checked={lifo} onCheckedChange={setLifo} aria-label={t("stack.lifo")} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-panel-soft/60 p-3">
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-fg-2">
            <ShieldCheck className="size-3.5 text-success" />
            {t("stack.maxLayers")}
          </span>
          <LayersInput
            value={maxLayers}
            onCommit={(v) => setMaxLayers(v)}
            a11y={t("stack.maxLayers")}
            toastMsg={t("stack.maxLayers.invalid")}
          />
        </label>
        {metrics && (
          <p className="mt-2 text-[11px] text-muted">
            {t("stack.physical")}:{" "}
            <span className="tnum text-fg-2">{metrics.maxLayers}</span> ·{" "}
            {t("stack.height")}:{" "}
            <span className="tnum text-fg-2">
              {(vehicle.innerHeight / 1000).toLocaleString("ru-RU", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 2,
              })}
              м
            </span>
          </p>
        )}
      </div>

      {metrics ? (
        <div className="rounded-xl border border-border bg-panel-soft/60 p-3">
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="text-muted">{t("stack.currentLayers")}</span>
            <span className="tnum text-fg-2">{metrics.currentLayers}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[11.5px]">
            <span className="text-muted">{t("stack.physical")}</span>
            <span className="tnum text-fg-2">{metrics.maxLayers}</span>
          </div>
          <div className="mt-2">
            <Badge variant={metrics.canStack ? "success" : "warning"}>
              {metrics.canStack ? t("metric.canStack") : t("metric.noStack")}
            </Badge>
          </div>
        </div>
      ) : (
        <p className="text-[11.5px] text-muted">{t("stack.none")}</p>
      )}

      <div className="space-y-1.5">
        <p className="flex items-start gap-1.5 text-[11px] text-muted">
          <LifeBuoy className="mt-0.5 size-3.5 shrink-0 text-accent" />
          <span>{t("stack.support")}</span>
        </p>
        <p className="flex items-start gap-1.5 text-[11px] text-muted">
          <Layers className="mt-0.5 size-3.5 shrink-0 text-accent" />
          <span>{t("stack.cylinders")}</span>
        </p>
      </div>
    </div>
  );
}

function LayersInput({
  value,
  onCommit,
  a11y,
  toastMsg,
}: {
  value: number;
  onCommit: (v: number) => void;
  a11y: string;
  toastMsg: string;
}) {
  const [local, setLocal] = useState(String(value));

  const commit = () => {
    const raw = local.trim();
    if (raw === "") {
      setLocal("0");
      onCommit(0);
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > MAX_CAP) {
      setLocal(String(value));
      toast.error(toastMsg);
      return;
    }
    const r = Math.min(MAX_CAP, Math.round(n));
    setLocal(String(r));
    onCommit(r);
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={MAX_CAP}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setLocal(String(value));
      }}
      aria-label={a11y}
      className={cn(
        "h-8 w-24 rounded-lg border border-border bg-panel-soft px-2 text-right text-xs text-fg outline-none transition-colors",
        "focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
      )}
    />
  );
}