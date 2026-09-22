"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  hint?: string;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  /** уникальный layoutId анимации на инстанс */
  id: string;
  className?: string;
  ariaLabel?: string;
}

/**
 * Премиальный сегмент-контроль: анимированный индикатор (spring),
 * hover/focus состояния, тактильный отклик.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  id,
  className,
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex items-center gap-0.5 rounded-xl border border-border bg-panel-soft p-1",
        className
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-150",
              "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
              active ? "text-fg" : "text-muted hover:text-fg-2"
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-lg border border-border-strong bg-panel-strong shadow-[0_2px_12px_-6px_rgba(0,0,0,0.55)]"
                transition={{ type: "spring", stiffness: 520, damping: 40 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5 whitespace-nowrap">
              {o.icon && <o.icon className="size-3.5" />}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
