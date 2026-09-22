"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Boxes, Copy, Layers, Pencil, Plus, SlidersHorizontal, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { useCargoPresets } from "@/hooks/use-presets";
import { useT } from "@/hooks/use-t";
import { formatLength, formatWeight } from "@/lib/units";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/store/use-layout-store";
import { useUiStore } from "@/store/use-ui-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CargoItem } from "@/types";

export function LeftPanel({ onClose }: { onClose?: () => void }) {
  const t = useT();
  const locale = useUiStore((s) => s.locale);
  const lengthUnit = useUiStore((s) => s.lengthUnit);
  const weightUnit = useUiStore((s) => s.weightUnit);

  const items = useLayoutStore((s) => s.items);
  const selectedIds = useLayoutStore((s) => s.selectedIds);
  const select = useLayoutStore((s) => s.select);
  const addItem = useLayoutStore((s) => s.addItem);
  const duplicateItems = useLayoutStore((s) => s.duplicateItems);
  const removeItems = useLayoutStore((s) => s.removeItems);
  const clearSelection = useLayoutStore((s) => s.clearSelection);
  const openDialog = useUiStore((s) => s.openDialog);
  const presets = useCargoPresets();

  const totalWeight = items.reduce((s, i) => s + i.weight * i.quantity, 0);

  const quickAdd = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    const name = locale === "en" ? preset.nameEn || preset.name : preset.name;
    addItem({ ...preset.data, name, presetId: preset.id });
    toast(t("toast.added"));
  };

  return (
    <aside className="glass flex h-full min-h-0 w-full flex-col rounded-2xl lg:w-[300px]">
      {/* шапка */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Boxes className="size-4 text-accent" />
          <span className="panel-label">{t("cargo.title")}</span>
          <span className="tnum rounded-full bg-panel-soft px-1.5 py-0.5 text-[10.5px] text-muted">
            {items.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("import.title")}
            title={t("import.title")}
            onClick={() => openDialog({ kind: "import" })}
          >
            <Upload className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("presets.manage")}
            title={t("presets.manage")}
            onClick={() => openDialog({ kind: "presets", tab: "cargo" })}
          >
            <SlidersHorizontal className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" aria-label={t("cargo.add")}>
                <Plus className="size-3.5" />
                {t("cargo.add")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[60vh] w-[290px] overflow-y-auto">
              <DropdownMenuLabel>{t("cargo.presets")}</DropdownMenuLabel>
              {presets
                .filter((p) => p.builtin)
                .map((p) => (
                  <DropdownMenuItem key={p.id} onClick={() => quickAdd(p.id)}>
                    <span
                      className="size-2.5 shrink-0 rounded-[4px]"
                      style={{ background: p.data.color }}
                    />
                    <span className="truncate">{locale === "en" ? p.nameEn || p.name : p.name}</span>
                  </DropdownMenuItem>
                ))}
              {presets.some((p) => !p.builtin) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{t("cargo.custom")}</DropdownMenuLabel>
                  {presets
                    .filter((p) => !p.builtin)
                    .map((p) => (
                      <DropdownMenuItem key={p.id} onClick={() => quickAdd(p.id)}>
                        <span
                          className="size-2.5 shrink-0 rounded-[4px]"
                          style={{ background: p.data.color }}
                        />
                        <span className="truncate">
                          {locale === "en" ? p.nameEn || p.name : p.name}
                        </span>
                      </DropdownMenuItem>
                    ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {onClose && (
            <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onClose}>
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* список */}
      <ScrollArea className="min-h-0 flex-1 px-3 py-3">
        {items.length === 0 ? (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong/70 p-5 text-center">
            <div className="rounded-2xl bg-accent/12 p-3.5">
              <Layers className="size-6 text-accent" />
            </div>
            <p className="text-sm font-medium text-fg-2">{t("cargo.empty.title")}</p>
            <p className="text-xs leading-relaxed text-muted">{t("cargo.empty.text")}</p>
            <Button size="sm" onClick={() => openDialog({ kind: "cargo" })}>
              <Plus className="size-3.5" />
              {t("cargo.empty.cta")}
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <CargoRow
                  key={item.id}
                  item={item}
                  selected={selectedIds.includes(item.id)}
                  onSelect={(additive) => select(item.id, additive)}
                  onDuplicate={() => {
                    duplicateItems([item.id]);
                    toast(t("toast.duplicated"));
                  }}
                  onEdit={() => openDialog({ kind: "cargo", itemId: item.id })}
                  onDelete={() => {
                    removeItems([item.id]);
                    clearSelection();
                    toast(t("toast.removed"));
                  }}
                  dimsText={dimsText(item, t, locale, lengthUnit)}
                  weightText={`${formatWeight(item.weight, weightUnit, locale)} × ${item.quantity} ${t("cargo.qty")}`}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </ScrollArea>

      {/* подвал */}
      <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[11.5px] text-muted">
        <span>
          {t("cargo.totalWeight")}:{" "}
          <span className="tnum font-semibold text-fg-2">
            {formatWeight(totalWeight, weightUnit, locale)}
          </span>
        </span>
        <span className="tnum">
          {items.reduce((s, i) => s + i.quantity, 0)} {t("cargo.qty")}
        </span>
      </div>
    </aside>
  );
}

function CargoRow({
  item,
  selected,
  onSelect,
  onDuplicate,
  onEdit,
  onDelete,
  dimsText,
  weightText,
}: {
  item: CargoItem;
  selected: boolean;
  onSelect: (additive: boolean) => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  dimsText: string;
  weightText: string;
}) {
  const t = useT();
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      onClick={(e) => onSelect(e.ctrlKey || e.metaKey || e.shiftKey)}
      className={cn(
        "group relative flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 transition-all duration-150",
        selected
          ? "border-primary/55 bg-primary/10 shadow-[0_0_0_1px_var(--glow-1)]"
          : "border-border bg-panel-soft/60 hover:border-border-strong hover:bg-panel"
      )}
    >
      <span
        className="size-8 shrink-0 rounded-lg shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)]"
        style={{
          background: `linear-gradient(135deg, ${item.color}, ${item.color}aa)`,
          boxShadow: `0 2px 10px -3px ${item.color}80`,
        }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-fg">{item.name}</div>
        <div className="tnum truncate text-[11px] text-muted">
          {dimsText} · {weightText}
        </div>
      </div>
      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("cargo.edit")}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("cargo.duplicate")}
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
        >
          <Copy className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("cargo.delete")}
          className="hover:text-danger"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </motion.li>
  );
}

export function dimsText(
  item: CargoItem,
  t: (k: string) => string,
  locale: "ru" | "en",
  unit: "mm" | "cm" | "m"
): string {
  if (item.shape === "cylinder") {
    return `Ø${formatLength(item.diameter, unit, locale)} × ${formatLength(item.length, unit, locale)}`;
  }
  return `${formatLength(item.length, unit, locale)} × ${formatLength(item.width, unit, locale)} × ${formatLength(item.height, unit, locale)}`;
}
