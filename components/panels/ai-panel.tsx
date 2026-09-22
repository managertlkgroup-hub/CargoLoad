"use client";

import { motion } from "framer-motion";
import { CheckCircle2, CircleAlert, Info, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { computeAdvices, type Advice } from "@/lib/advanced/hints";
import { useLayoutStore } from "@/store/use-layout-store";
import { useT } from "@/hooks/use-t";
import { cn } from "@/lib/utils";
import type { LoadMetrics } from "@/types";

const LEVEL_STYLE: Record<Advice["level"], { card: string; icon: ReactNode }> = {
  success: {
    card: "border-success/25",
    icon: <CheckCircle2 className="size-3.5 text-success" />,
  },
  warn: {
    card: "border-warning/25",
    icon: <CircleAlert className="size-3.5 text-warning" />,
  },
  info: {
    card: "border-accent/25",
    icon: <Info className="size-3.5 text-accent" />,
  },
};

/** Офлайн AI-советы: эвристики по одиночному снапшоту метрик раскладки. */
export function AiPanel({ metrics }: { metrics: LoadMetrics | null }) {
  const t = useT();
  const mode = useLayoutStore((s) => s.mode);
  const stacking = useLayoutStore((s) => s.stacking);
  const gaps = useLayoutStore((s) => s.gaps[mode]);

  if (!metrics) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-panel-soft/40 p-3 text-[11.5px] text-muted">
        {t("hint.empty")}
      </p>
    );
  }

  const anyGapPositive = gaps.wall > 0 || gaps.rowWidth > 0 || gaps.rowLength > 0;
  const advices = computeAdvices(metrics, { mode, stacking, anyGapPositive });

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-1.5 text-[11px] text-muted">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" />
        <span>{t("panel.ai.hint")}</span>
      </p>

      {advices.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-panel-soft/40 p-3 text-[11.5px] text-muted">
          {t("hint.none")}
        </p>
      ) : (
        <div className="space-y-2">
          {advices.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
              className={cn(
                "flex items-start gap-2 rounded-xl border bg-panel-soft/60 p-2.5 text-[11.5px]",
                LEVEL_STYLE[a.level].card
              )}
            >
              <span className="mt-0.5 shrink-0">{LEVEL_STYLE[a.level].icon}</span>
              <span className="text-fg-2">{t(a.textKey, a.vars)}</span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}