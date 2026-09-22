"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { useT } from "@/hooks/use-t";
import type { PdfData } from "@/components/export/pdf-doc";
import { DEFAULT_VEHICLE_ID } from "@/lib/constants";
import type { ExportModel } from "@/lib/export/model";
import type { MetricsLabels } from "@/lib/export/png";
import type { XlsxTexts } from "@/lib/export/xlsx";
import { dimsFor } from "@/lib/geometry";
import { translate } from "@/lib/i18n";
import { findVehicle } from "@/lib/presets/select";
import {
  formatLength,
  formatNumber,
  formatVolume,
  formatWeight,
} from "@/lib/units";
import { useLayoutStore } from "@/store/use-layout-store";
import { usePresetsStore } from "@/store/use-presets-store";
import { useUiStore } from "@/store/use-ui-store";
import type { LoadMetrics } from "@/types";

export type ExportTarget = "pdf" | "png" | "excel";

/** Свежий снапшот раскладки для экспорта (читается на клик, не из рендера). */
function buildModel(): ExportModel {
  const layout = useLayoutStore.getState();
  const presets = usePresetsStore.getState();
  const ui = useUiStore.getState();
  const vehicle =
    findVehicle(presets, layout.vehicleId) ??
    findVehicle(presets, DEFAULT_VEHICLE_ID)!;
  return {
    items: layout.items,
    placements: layout.placements,
    unplaced: layout.unplaced,
    vehicle,
    mode: layout.mode,
    gaps: layout.gaps[layout.mode],
    gapsByMode: layout.gaps,
    stacking: layout.stacking,
    lifo: layout.lifo,
    maxLayers: layout.maxLayers,
    loadingSide: layout.loadingSide,
    stops: layout.stops,
    activeLayer: ui.activeLayer,
    layers: layout.layers,
    metrics: layout.metrics,
    locale: ui.locale,
    lengthUnit: ui.lengthUnit,
    weightUnit: ui.weightUnit,
    generatedAt: new Date().toISOString(),
  };
}

function baseName(m: ExportModel): string {
  const d = new Date(m.generatedAt);
  const pad = (v: number) => String(v).padStart(2, "0");
  const slug = (s: string) =>
    s
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  return `cargoplanner-${slug(m.vehicle.name)}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* ----------------------------- PDF текст ----------------------------- */

function buildPdfData(m: ExportModel): PdfData {
  const s = (k: string) => translate(m.locale, k);
  const n = (v: number, d = 1) => formatNumber(v, d, m.locale);
  const len = (v: number) => formatLength(v, m.lengthUnit, m.locale);
  const kg = (v: number) => formatWeight(v, m.weightUnit, m.locale);
  const dateStr = new Intl.DateTimeFormat(m.locale === "ru" ? "ru-RU" : "en-US", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(m.generatedAt));

  const v = m.vehicle;
  const params: PdfData["params"] = [
    { label: s("vehicle.label"), value: v.name },
    {
      label: s("vehicle.dims"),
      value: `${len(v.innerLength)} × ${len(v.innerWidth)} × ${len(v.innerHeight)}`,
    },
    { label: s("vehicle.payload"), value: kg(v.payload) },
    { label: s("mode.label"), value: s(`mode.${m.mode}`) },
    { label: s("gaps.wall"), value: len(m.gaps.wall) },
    { label: s("gaps.rowWidth"), value: len(m.gaps.rowWidth) },
    { label: s("gaps.rowLength"), value: len(m.gaps.rowLength) },
    { label: s("stack.enabled"), value: m.stacking ? s("common.yes") : s("common.no") },
    { label: s("stack.lifo"), value: m.lifo ? s("common.yes") : s("common.no") },
    { label: s("stack.maxLayers"), value: m.maxLayers > 0 ? String(m.maxLayers) : "—" },
    { label: s("vehicle.loadingSide"), value: s(`loading.${m.loadingSide}`) },
    { label: s("export.generated"), value: dateStr },
  ];

  const metrics: PdfData["metrics"] = [];
  const mm = m.metrics;
  if (mm) {
    const tone = (lv: LoadMetrics["cog"]["level"]): "ok" | "warn" | "crit" | undefined =>
      lv === "ok" ? undefined : lv;
    const tonePct = (pct: number) => (pct > 100 ? "crit" : pct > 80 ? "warn" : "ok");
    metrics.push({
      label: s("metric.volume"),
      value: `${formatVolume(mm.volumeUsedM3, m.locale)} / ${formatVolume(mm.volumeTotalM3, m.locale)} м³ (${n(mm.volumePct)} %)`,
    });
    metrics.push({
      label: s("metric.weight"),
      value: `${kg(mm.weightUsedKg)} / ${kg(mm.weightCapacityKg)} (${n(mm.weightPct)} %)`,
    });
    metrics.push({
      label: s("metric.placed"),
      value: `${n(mm.placedCount, 0)} / ${n(mm.totalCount, 0)}`,
    });
    metrics.push({
      label: s("metric.bbox"),
      value: `${len(mm.bboxNoGaps.length)} × ${len(mm.bboxNoGaps.width)} × ${len(mm.bboxNoGaps.height)}`,
    });
    metrics.push({
      label: s("metric.layers"),
      value: `${n(mm.currentLayers, 0)}  (${s("metric.maxLayers")}: ${n(mm.maxLayers, 0)})`,
    });
    metrics.push({ label: s("metric.ldm"), value: n(mm.ldm, 2) });
    metrics.push({
      label: s("metric.cog"),
      value: `${s(`metric.cog.${mm.cog.level}`)} · ${n(mm.cog.longitudinalPct)} / ${n(mm.cog.lateralPct)} %`,
      tone: tone(mm.cog.level),
    });
    if (mm.axlesAvailable) {
      for (const a of mm.axles) {
        metrics.push({
          label: a.label,
          value: `${n(a.pct, 1)} % (${n(a.loadKg, 0)} / ${n(a.maxLoadKg, 0)} кг)`,
          tone: tonePct(a.pct),
        });
      }
    }
  }

  const itemById = new Map(m.items.map((i) => [i.id, i]));
  const placedBy = new Map<string, number>();
  for (const p of m.placements) {
    placedBy.set(p.itemId, (placedBy.get(p.itemId) ?? 0) + 1);
  }
  const goods = m.items.map((item) => ({
    name: item.name,
    color: item.color,
    placed: placedBy.get(item.id) ?? 0,
    total: item.quantity,
    weight: kg(item.weight),
  }));

  const unplaced = m.unplaced.map((u) => ({
    name: itemById.get(u.itemId)?.name ?? u.itemId,
    qty: u.quantity,
    weight: kg(itemById.get(u.itemId)?.weight ?? 0),
    reason: s(`reason.${u.reason}`),
  }));

  // слои: только те, где есть грузы; легенда — уникальные цвета слоя
  const colorName = new Map<string, string>();
  for (const p of m.placements) {
    const item = itemById.get(p.itemId);
    if (item && !colorName.has(item.color)) colorName.set(item.color, item.name);
  }
  const layers: PdfData["layers"] = [...m.layers]
    .sort((a, b) => a.z - b.z)
    .filter((layer) =>
      m.placements.some((p) => itemById.has(p.itemId) && Math.abs(p.z - layer.z) < 1)
    )
    .map((layer) => {
      const boxes = m.placements
        .filter((p) => {
          const item = itemById.get(p.itemId);
          return item && Math.abs(p.z - layer.z) < 1;
        })
        .map((p) => {
          const item = itemById.get(p.itemId)!;
          const d = dimsFor(item, p.yaw, p.axis);
          return { x: p.x, y: p.y, w: d.dx, h: d.dy, color: item.color };
        });
      const legend = [...new Set(boxes.map((b) => b.color))].map((color) => ({
        color,
        name: colorName.get(color) ?? color,
      }));
      return { index: layer.index, z: len(layer.z), L: v.innerLength, W: v.innerWidth, boxes, legend };
    });

  return {
    title: s("app.tagline"),
    subtitle: `${v.name} · ${s(`mode.${m.mode}`)}`,
    vehicleName: v.name,
    vehicleMeta: `${len(v.innerLength)} × ${len(v.innerWidth)} × ${len(v.innerHeight)} мм · ${s("vehicle.payload")} ${kg(v.payload)}`,
    generatedAt: dateStr,
    sections: {
      params: s("export.section.params"),
      metrics: s("export.section.metrics"),
      goods: s("export.section.goods"),
      schemes: s("export.section.schemes"),
      instructions: s("export.section.instructions"),
    },
    params,
    metrics,
    goods,
    goodsHeader: {
      name: s("cargo.field.name"),
      placed: s("metric.placed"),
      qty: s("cargo.qty"),
      weight: s("metric.weight"),
    },
    unplaced,
    layers,
    instruction: {
      title: s("export.section.instructions"),
      paragraphs: [
        s("export.instructions.p1"),
        s("export.instructions.p2"),
        s("export.instructions.p3"),
      ],
    },
    footer: `${s("app.tagline")} · CargoPlanner`,
  };
}

/* ----------------------------- XLSX текст ----------------------------- */

function buildXlsxTexts(m: ExportModel): XlsxTexts {
  const s = (k: string) => translate(m.locale, k);
  return {
    sheets: {
      params: s("export.section.params"),
      goods: s("cargo.title"),
      gaps: s("gaps.title"),
      layout: s("export.sheet.layout"),
    },
    mode: { along: s("mode.along"), cross: s("mode.cross"), mixed: s("mode.mixed") },
    yes: s("common.yes"),
    no: s("common.no"),
    shape: {
      box: s("cargo.shape.box"),
      cylinder: s("cargo.shape.cylinder"),
      oversize: s("cargo.shape.oversize"),
    },
    axis: { up: s("cargo.axis.up"), side: s("cargo.axis.side") },
    labels: {
      vehicle: s("vehicle.label"),
      dims: s("vehicle.dims"),
      payload: s("vehicle.payload"),
      mode: s("mode.label"),
      wall: s("gaps.wall"),
      rowWidth: s("gaps.rowWidth"),
      rowLength: s("gaps.rowLength"),
      stacking: s("stack.enabled"),
      lifo: s("stack.lifo"),
      maxLayers: s("stack.maxLayers"),
      loadingSide: s("vehicle.loadingSide"),
      side: {
        rear: s("loading.rear"),
        left: s("loading.left"),
        right: s("loading.right"),
        top: s("loading.top"),
      },
      name: s("cargo.field.name"),
      type: s("cargo.field.type"),
      length: s("cargo.field.length"),
      width: s("cargo.field.width"),
      height: s("cargo.field.height"),
      diameter: s("cargo.field.diameter"),
      weight: s("cargo.field.weight"),
      quantity: s("cargo.field.quantity"),
      stackable: s("cargo.stackable"),
      group: s("cargo.group"),
      color: s("cargo.field.color"),
      stop: s("cargo.field.stop"),
      x: s("export.x"),
      y: s("export.y"),
      z: s("export.z"),
      yaw: s("export.yaw"),
      axis: s("export.axis"),
      size: s("export.size"),
      placed: s("metric.placed"),
      used: s("metric.used"),
      volume: s("metric.volume"),
      bbox: s("metric.bbox"),
      layers: s("metric.layers"),
      ldm: s("metric.ldm"),
      cog: s("metric.cog"),
      axles: s("metric.axles"),
    },
  };
}

/* ----------------------------- хук ----------------------------- */

export function useExport() {
  const t = useT();
  const [busy, setBusy] = useState<ExportTarget | null>(null);
  const canExport = useLayoutStore((s) => s.items.length > 0);
  const viewMode = useUiStore((s) => s.viewMode);

  const exportPdf = useCallback(async () => {
    setBusy("pdf");
    try {
      const m = buildModel();
      const data = buildPdfData(m);
      const { exportPdf: run } = await import("@/lib/export/pdf");
      await run(data, `${baseName(m)}.pdf`);
      toast.success(t("toast.exportReady"));
    } catch {
      toast.error(t("toast.exportFail"));
    } finally {
      setBusy(null);
    }
  }, [t]);

  const exportPng = useCallback(async () => {
    setBusy("png");
    try {
      const m = buildModel();
      const v = m.vehicle;
      const png = await import("@/lib/export/png");
      const labels: MetricsLabels = {
        volume: t("metric.volume"),
        weight: t("metric.weight"),
        placed: t("metric.placed"),
        bbox: t("metric.bbox"),
        layers: t("metric.layers"),
        ldm: t("metric.ldm"),
        cog: t("metric.cog"),
      };
      const overlayLines = m.metrics
        ? png.buildMetricsOverlay(
            m.metrics,
            m.locale,
            { length: m.lengthUnit, weight: m.weightUnit },
            labels
          )
        : [];
      const size = { w: 1600, h: 1100 };
      const dataUrl = png.renderPng({
        viewMode: viewMode === "3d" ? "3d" : "2d",
        size,
        layout: {
          size,
          truck: { innerLength: v.innerLength, innerWidth: v.innerWidth },
          items: m.items,
          placements: m.placements,
          layers: m.layers,
          activeLayer: m.activeLayer,
          loadingSide: m.loadingSide,
          locale: m.locale,
          lengthUnit: m.lengthUnit,
          legendTitle: t("legend.title"),
        },
        overlayLines,
      });
      png.downloadDataUrl(dataUrl, `${baseName(m)}-${viewMode}.png`);
      toast.success(t("toast.exportReady"));
    } catch {
      toast.error(t("toast.exportFail"));
    } finally {
      setBusy(null);
    }
  }, [t, viewMode]);

  const exportExcel = useCallback(async () => {
    setBusy("excel");
    try {
      const m = buildModel();
      const tx = buildXlsxTexts(m);
      const { exportExcel: run } = await import("@/lib/export/xlsx");
      run(m, tx, `${baseName(m)}.xlsx`);
      toast.success(t("toast.exportReady"));
    } catch {
      toast.error(t("toast.exportFail"));
    } finally {
      setBusy(null);
    }
  }, [t]);

  return { busy, exporting: busy !== null, canExport, exportPdf, exportPng, exportExcel };
}