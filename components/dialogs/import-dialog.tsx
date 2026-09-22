"use client";

import { FileSpreadsheet, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useT } from "@/hooks/use-t";
import { parseCargoFile, type ImportParseResult } from "@/lib/excel-import";
import type { ImportRow } from "@/lib/validation";
import { formatLength, formatWeight } from "@/lib/units";
import { useLayoutStore } from "@/store/use-layout-store";
import { useUiStore } from "@/store/use-ui-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { CargoItemDraft } from "@/types";

const MAX_PREVIEW = 5;
const MAX_ERRORS_VISIBLE = 8;

function toDraft(row: ImportRow): CargoItemDraft {
  return {
    name: row.name,
    shape: row.shape,
    length: row.length,
    width: row.width,
    height: row.height,
    diameter: row.diameter,
    weight: row.weight,
    quantity: row.quantity,
    stackable: row.stackable,
    maxTopLoad: row.stackable ? 500 : 0,
    group: row.group,
    color: row.color,
    cylinderAxis: "up",
    stopIndex: 0,
  };
}

/**
 * Импорт грузов из Excel/CSV: выбор файла, разбор (xlsx + papaparse),
 * Zod-валидация, отчёт об ошибках и добавление валидных строк в раскладку.
 */
export function ImportDialog() {
  const t = useT();
  const locale = useUiStore((s) => s.locale);
  const lengthUnit = useUiStore((s) => s.lengthUnit);
  const weightUnit = useUiStore((s) => s.weightUnit);
  const dialog = useUiStore((s) => s.dialog);
  const dialogOpen = useUiStore((s) => s.dialogOpen);
  const closeDialog = useUiStore((s) => s.closeDialog);

  const addItems = useLayoutStore((s) => s.addItems);

  const open = dialogOpen && dialog?.kind === "import";
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ImportParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onOpenChange = (v: boolean) => {
    if (!v) {
      setFileName("");
      setResult(null);
      setBusy(false);
      closeDialog();
    }
  };

  const onFile = async (file: File | undefined | null) => {
    if (!file) return;
    setBusy(true);
    setFileName(file.name);
    try {
      const res = await parseCargoFile(file);
      setResult(res);
    } finally {
      setBusy(false);
    }
  };

  const validCount = result?.rows.length ?? 0;

  return (
    <Dialog
      open={!!open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-accent" />
            {t("import.title")}
          </DialogTitle>
          <DialogDescription>{t("import.hint")}</DialogDescription>
        </DialogHeader>

        {/* выбор файла */}
        <div className="grid gap-1.5">
          <label
            htmlFor="import-file"
            className={cnDrop(busy)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onFile(e.dataTransfer.files?.[0]);
            }}
          >
            <input
              ref={inputRef}
              id="import-file"
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Upload className="size-5 text-accent" />
            <span className="text-[13px] font-medium text-fg-2">
              {fileName || t("import.drop")}
            </span>
            <span className="text-[10.5px] text-muted">
              .xlsx · .xls · .csv{" "}
              {fileName &&
                (result?.ok === false
                  ? "· " + t("import.parseError")
                  : busy
                    ? "· " + t("status.packing")
                    : "")}
            </span>
          </label>
          <p className="px-1 text-[10.5px] leading-relaxed text-muted">{t("import.columns")}</p>

          {result?.ok === false && (
            <p className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">
              {result.error === "header.notFound"
                ? t("import.headerNotFound")
                : t("import.parseError")}
            </p>
          )}
        </div>

        {/* отчёт */}
        {result?.ok && (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent">{t("import.valid", { n: validCount })}</Badge>
              {result.errors.length > 0 && (
                <Badge variant="danger">{t("import.errors", { n: result.errors.length })}</Badge>
              )}
              {result.total > 0 && <span className="tnum text-[11px] text-muted">{t("import.total", { n: result.total })}</span>}
            </div>

            {validCount > 0 && (
              <div className="rounded-xl border border-border bg-panel-soft/60 px-3 py-2">
                <div className="panel-label">{t("import.preview")}</div>
                <ul className="mt-1 grid gap-1">
                  {result.rows.slice(0, MAX_PREVIEW).map((r, i) => {
                    const dims =
                      r.shape === "cylinder"
                        ? `Ø${formatLength(r.diameter, lengthUnit, locale)} × ${formatLength(r.length, lengthUnit, locale)}`
                        : `${formatLength(r.length, lengthUnit, locale)} × ${formatLength(r.width, lengthUnit, locale)} × ${formatLength(r.height, lengthUnit, locale)}`;
                    return (
                      <li key={i} className="flex items-center gap-2 text-[11.5px] text-fg-2">
                        <span
                          className="size-2.5 shrink-0 rounded-[4px]"
                          style={{ background: r.color }}
                        />
                        <span className="truncate">{r.name}</span>
                        <span className="tnum ml-auto shrink-0 text-muted">
                          {dims} · {formatWeight(r.weight, weightUnit, locale)} × {r.quantity} {t("cargo.qty")}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {result.rows.length > MAX_PREVIEW && (
                  <div className="mt-1 text-[10.5px] text-muted">
                    {t("import.more", { n: result.rows.length - MAX_PREVIEW })}
                  </div>
                )}
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="rounded-xl border border-warning/30 bg-warning/6 px-3 py-2">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-warning">
                  <X className="size-3.5" />
                  {t("import.errors.title")}
                </div>
                <ul className="mt-1 grid gap-1">
                  {result.errors.slice(0, MAX_ERRORS_VISIBLE).map((e, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11.5px] text-fg-2">
                      <span className="tnum shrink-0 rounded bg-panel-strong px-1.5 py-0.5 text-[10px] text-muted">
                        {t("import.row", { n: e.row })}
                      </span>
                      <span className="min-w-0 break-words">{e.message}</span>
                    </li>
                  ))}
                </ul>
                {result.errors.length > MAX_ERRORS_VISIBLE && (
                  <div className="mt-1 text-[10.5px] text-muted">
                    {t("import.more", { n: result.errors.length - MAX_ERRORS_VISIBLE })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" onClick={closeDialog}>
            {t("action.cancel")}
          </Button>
          <Button
            type="button"
            disabled={validCount === 0 || busy}
            onClick={() => {
              if (!result) return;
              addItems(result.rows.map(toDraft));
              toast(t("import.added", { n: validCount }));
              closeDialog();
            }}
          >
            <Upload className="size-4" />
            {t("import.add", { n: validCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function cnDrop(busy: boolean): string {
  return [
    "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-accent/40 bg-accent/6 px-4 py-6 text-center transition-all duration-150 hover:border-accent/70 hover:bg-accent/10",
    busy ? "pointer-events-none opacity-60" : "",
  ]
    .filter(Boolean)
    .join(" ");
}