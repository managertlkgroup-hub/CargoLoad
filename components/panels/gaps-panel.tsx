"use client";

import { Ruler, Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Segmented } from "@/components/segmented";
import { useT } from "@/hooks/use-t";
import { LIMITS } from "@/lib/constants";
import { useLayoutStore } from "@/store/use-layout-store";
import type { Gaps, PackMode } from "@/types";

const MODE_OPTIONS: Array<{ value: PackMode; label: string }> = [
  { value: "along", label: "Вдоль" },
  { value: "cross", label: "Поперёк" },
  { value: "mixed", label: "Смешанный" },
];

/** Ручной ввод с валидацией: пустое → 0, вне диапазона → откат + тост. */
function GapField({
  label,
  storeKey,
  value,
  onCommit,
}: {
  label: string;
  storeKey: keyof Gaps;
  value: number;
  onCommit: (field: keyof Gaps, value: number) => void;
}) {
  const t = useT();
  const prev = value;
  const [local, setLocal] = useState(String(value));

  const commit = () => {
    const raw = local.trim().replace(",", ".");
    if (raw === "") {
      setLocal("0");
      onCommit(storeKey, 0);
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < LIMITS.gaps.min || n > LIMITS.gaps.max) {
      setLocal(String(prev));
      toast.error(t("gaps.invalid"));
      return;
    }
    const r = Math.round(n);
    setLocal(String(r));
    onCommit(storeKey, r);
  };

  return (
    <label className="flex items-center justify-between gap-2 text-[11.5px]">
      <span className="text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={LIMITS.gaps.min}
        max={LIMITS.gaps.max}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setLocal(String(prev));
        }}
        aria-label={label}
        className="h-8 w-20 rounded-lg border border-border bg-panel-soft px-2 text-right text-xs text-fg outline-none transition-colors focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
      />
    </label>
  );
}

/** Зазоры per-mode: переключатель режима + три поля с валидацией. */
export function GapsPanel() {
  const t = useT();
  const currentMode = useLayoutStore((s) => s.mode);
  const [editMode, setEditMode] = useState<PackMode>(currentMode);
  const gaps = useLayoutStore((s) => s.gaps[editMode]);
  const setGaps = useLayoutStore((s) => s.setGaps);

  const commit = (field: keyof Gaps, value: number) => {
    setGaps(editMode, { ...gaps, [field]: value });
  };

  const applyAuto = () => {
    setGaps(editMode, {
      wall: LIMITS.gaps.auto,
      rowWidth: LIMITS.gaps.auto,
      rowLength: LIMITS.gaps.auto,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-fg-2">
          <Ruler className="size-3.5 text-accent" />
          {t("gaps.title")}
        </span>
        <button
          type="button"
          onClick={applyAuto}
          className="flex items-center gap-1 rounded-lg border border-border bg-panel-soft px-2 py-1 text-[11px] text-fg-2 transition-colors hover:border-accent/40 hover:text-accent"
        >
          <Wand2 className="size-3" />
          {t("gaps.auto")}
        </button>
      </div>

      <div>
        <p className="mb-1.5 text-[10.5px] text-muted">{t("gaps.mode")}</p>
        <Segmented
          id="gaps-mode"
          value={editMode}
          options={MODE_OPTIONS}
          onChange={(v) => setEditMode(v)}
          className="w-full"
          ariaLabel={t("gaps.mode")}
        />
      </div>

      <div className="space-y-2 rounded-xl border border-border bg-panel-soft/60 p-3">
        {(
          [
            ["wall", gaps.wall],
            ["rowWidth", gaps.rowWidth],
            ["rowLength", gaps.rowLength],
          ] as Array<[keyof Gaps, number]>
        ).map(([field, value]) => (
          <GapField
            key={`${editMode}-${field}-${value}`}
            label={t(
              field === "wall" ? "gaps.wall" : field === "rowWidth" ? "gaps.rowWidth" : "gaps.rowLength"
            )}
            storeKey={field}
            value={value}
            onCommit={commit}
          />
        ))}
      </div>

      <p className="flex items-start gap-1.5 text-[11px] text-muted">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" />
        <span>{t("gaps.hint")}</span>
      </p>
    </div>
  );
}