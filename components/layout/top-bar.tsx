"use client";

import {
  AlignEndHorizontal,
  Camera,
  Columns3,
  FileSpreadsheet,
  FileText,
  Languages,
  LayoutGrid,
  Loader2,
  PanelLeft,
  PanelRight,
  Redo2,
  Save,
  Share2,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { useExport } from "@/hooks/use-export";
import { useT } from "@/hooks/use-t";
import { LoadingSideSelect } from "@/components/loading-side-select";
import { Logo } from "@/components/logo";
import { Segmented } from "@/components/segmented";
import { ThemeToggle } from "@/components/theme-toggle";
import { VehicleSelect } from "@/components/vehicle-select";
import { lengthUnitLabel, weightUnitLabel } from "@/lib/units";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLayoutStore } from "@/store/use-layout-store";
import { useUiStore } from "@/store/use-ui-store";
import type { LengthUnit, PackMode, ViewMode, WeightUnit } from "@/types";

export function TopBar() {
  const t = useT();
  const mode = useLayoutStore((s) => s.mode);
  const setMode = useLayoutStore((s) => s.setMode);
  const undo = useLayoutStore((s) => s.undo);
  const redo = useLayoutStore((s) => s.redo);
  const canUndo = useLayoutStore((s) => s.past.length > 0);
  const canRedo = useLayoutStore((s) => s.future.length > 0);
  const clearLayout = useLayoutStore((s) => s.clearLayout);

  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const leftOpen = useUiStore((s) => s.leftPanelOpen);
  const rightOpen = useUiStore((s) => s.rightPanelOpen);
  const setLeft = useUiStore((s) => s.setLeftPanel);
  const setRight = useUiStore((s) => s.setRightPanel);
  const openDialog = useUiStore((s) => s.openDialog);
  const locale = useUiStore((s) => s.locale);
  const setLocale = useUiStore((s) => s.setLocale);
  const lengthUnit = useUiStore((s) => s.lengthUnit);
  const weightUnit = useUiStore((s) => s.weightUnit);
  const setUnits = useUiStore((s) => s.setUnits);

  const { busy, exporting, canExport, exportPdf, exportPng, exportExcel } = useExport();

  return (
    <header className="glass sticky top-0 z-40 m-3 mb-0 rounded-2xl px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {/* логотип + мобильные переключатели панелей */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-label={t("panel.cargo")}
            onClick={() => setLeft(!leftOpen)}
          >
            <PanelLeft className="size-4" />
          </Button>
          <Logo size={26} />
          <Badge variant="accent" className="hidden sm:inline-flex">
            {t("app.beta")}
          </Badge>
        </div>

        {/* центр: авто + режим + сторона загрузки */}
        <div className="order-3 flex w-full flex-wrap items-center gap-2 lg:order-none lg:w-auto lg:flex-1 lg:justify-center lg:gap-3">
          <VehicleSelect />
          <Segmented<PackMode>
            id="mode"
            value={mode}
            onChange={setMode}
            ariaLabel={t("mode.label")}
            options={[
              { value: "along", label: t("mode.along"), hint: t("mode.along.hint"), icon: AlignEndHorizontal },
              { value: "cross", label: t("mode.cross"), hint: t("mode.cross.hint"), icon: Columns3 },
              { value: "mixed", label: t("mode.mixed"), hint: t("mode.mixed.hint"), icon: LayoutGrid },
            ]}
          />
          <LoadingSideSelect />
        </div>

        {/* действия */}
        <div className="ml-auto flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!canUndo}
                aria-label={t("action.undo")}
                onClick={undo}
              >
                <Undo2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t("action.undo")} · Ctrl+Z
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!canRedo}
                aria-label={t("action.redo")}
                onClick={redo}
              >
                <Redo2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t("action.redo")} · Ctrl+Shift+Z
            </TooltipContent>
          </Tooltip>

          <Segmented<ViewMode>
            id="view"
            value={viewMode}
            onChange={setViewMode}
            ariaLabel={t("view.label")}
            options={[
              { value: "2d", label: t("view.2d") },
              { value: "3d", label: t("view.3d") },
            ]}
          />

          <span className="mx-0.5 h-6 w-px bg-border" />

          <ThemeToggle />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 px-2"
                aria-label={t("app.lang.label")}
                onClick={() => setLocale(locale === "ru" ? "en" : "ru")}
              >
                <Languages className="size-4" />
                <span className="tnum text-xs font-semibold uppercase">
                  {locale === "ru" ? "RU" : "EN"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("app.lang.label")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Segmented<LengthUnit>
                  id="units-length"
                  value={lengthUnit}
                  onChange={(v) => setUnits({ lengthUnit: v })}
                  ariaLabel={t("units.length.label")}
                  options={[
                    { value: "mm", label: lengthUnitLabel("mm", locale) },
                    { value: "cm", label: lengthUnitLabel("cm", locale) },
                    { value: "m", label: lengthUnitLabel("m", locale) },
                  ]}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>{t("units.length.label")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Segmented<WeightUnit>
                  id="units-weight"
                  value={weightUnit}
                  onChange={(v) => setUnits({ weightUnit: v })}
                  ariaLabel={t("units.weight.label")}
                  options={[
                    { value: "kg", label: weightUnitLabel("kg", locale) },
                    { value: "t", label: weightUnitLabel("t", locale) },
                  ]}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>{t("units.weight.label")}</TooltipContent>
          </Tooltip>

          <span className="mx-0.5 h-6 w-px bg-border" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!canExport || exporting}
                aria-label={t("export.pdf")}
                onClick={exportPdf}
              >
                {busy === "pdf" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileText className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("export.pdf")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!canExport || exporting}
                aria-label={t("export.png")}
                onClick={exportPng}
              >
                {busy === "png" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Camera className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("export.png")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!canExport || exporting}
                aria-label={t("export.excel")}
                onClick={exportExcel}
              >
                {busy === "excel" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("export.excel")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("action.sessions")}
                onClick={() => openDialog({ kind: "sessions" })}
              >
                <Save className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("action.sessions")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("share.title")}
                onClick={() => openDialog({ kind: "share" })}
              >
                <Share2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("share.title")}</TooltipContent>
          </Tooltip>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t("action.clearLayout")}>
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-sm">
              <AlertDialogHeader>
                <AlertDialogTitle>{t("action.clearLayout")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("action.clearLayout.confirm")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("action.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    clearLayout();
                    toast(t("toast.cleared"));
                  }}
                >
                  {t("action.confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-label={t("panel.metrics")}
            onClick={() => setRight(!rightOpen)}
          >
            <PanelRight className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
