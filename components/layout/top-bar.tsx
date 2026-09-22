"use client";

import {
  AlignEndHorizontal,
  Columns3,
  LayoutGrid,
  Library,
  PanelLeft,
  PanelRight,
  Redo2,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { useT } from "@/hooks/use-t";
import { LoadingSideSelect } from "@/components/loading-side-select";
import { Logo } from "@/components/logo";
import { Segmented } from "@/components/segmented";
import { ThemeToggle } from "@/components/theme-toggle";
import { VehicleSelect } from "@/components/vehicle-select";
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
import type { PackMode, ViewMode } from "@/types";

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

  return (
    <header className="glass sticky top-0 z-40 m-3 mb-0 rounded-2xl px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
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

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("presets.manage")}
                onClick={() => openDialog({ kind: "presets" })}
              >
                <Library className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("presets.manage")}</TooltipContent>
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

          <ThemeToggle />

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
