"use client";

import { BarChart3, Layers, Loader2, PackageCheck, Ruler, Sparkles, X } from "lucide-react";

import { useLoadMetrics } from "@/hooks/use-load-metrics";
import { useT } from "@/hooks/use-t";
import { useUiStore } from "@/store/use-ui-store";
import { useLayoutStore } from "@/store/use-layout-store";
import { formatNumber } from "@/lib/units";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiPanel } from "@/components/panels/ai-panel";
import { GapsPanel } from "@/components/panels/gaps-panel";
import { MetricsPanel } from "@/components/panels/metrics-panel";
import { StackingPanel } from "@/components/panels/stacking-panel";
import { UnplacedPanel } from "@/components/panels/unplaced-panel";

export function RightPanel({ onClose }: { onClose?: () => void }) {
  const t = useT();
  const locale = useUiStore((s) => s.locale);
  const packStatus = useLayoutStore((s) => s.packStatus);
  const lastPackMs = useLayoutStore((s) => s.lastPackMs);
  const hasItems = useLayoutStore((s) => s.items.length > 0);
  const metrics = useLoadMetrics();

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

      <Tabs defaultValue="metrics" className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2">
        <TabsList className="grid w-full grid-cols-4 gap-1 p-1">
          <TabsTrigger value="metrics" className="flex-col gap-0.5 px-0 py-1.5 text-[10.5px]">
            <BarChart3 className="size-3.5" />
            {t("panel.metrics.short")}
          </TabsTrigger>
          <TabsTrigger value="gaps" className="flex-col gap-0.5 px-0 py-1.5 text-[10.5px]">
            <Ruler className="size-3.5" />
            {t("panel.gaps.short")}
          </TabsTrigger>
          <TabsTrigger value="stack" className="flex-col gap-0.5 px-0 py-1.5 text-[10.5px]">
            <Layers className="size-3.5" />
            {t("panel.stack.short")}
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex-col gap-0.5 px-0 py-1.5 text-[10.5px]">
            <Sparkles className="size-3.5" />
            {t("panel.ai.short")}
          </TabsTrigger>
        </TabsList>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <TabsContent value="metrics" className="mt-3 space-y-3">
            {!hasItems ? (
              <EmptyPanel />
            ) : (
              <>
                {metrics && <MetricsPanel metrics={metrics} />}
                {metrics && <UnplacedPanel metrics={metrics} />}
              </>
            )}
          </TabsContent>
          <TabsContent value="gaps" className="mt-3">
            <GapsPanel />
          </TabsContent>
          <TabsContent value="stack" className="mt-3">
            <StackingPanel metrics={metrics} />
          </TabsContent>
          <TabsContent value="ai" className="mt-3">
            <AiPanel metrics={metrics} />
          </TabsContent>
        </div>
      </Tabs>
    </aside>
  );
}

function EmptyPanel() {
  const t = useT();
  return (
    <div className="rounded-xl border border-dashed border-border bg-panel-soft/40 p-4 text-center">
      <PackageCheck className="mx-auto mb-2 size-6 text-muted" />
      <p className="text-[11.5px] text-muted">{t("cargo.none")}</p>
    </div>
  );
}