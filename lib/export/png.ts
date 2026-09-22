import { getCapturedGL } from "@/lib/export/capture";
import { dimsFor } from "@/lib/geometry";
import {
  formatLength,
  formatNumber,
  formatVolume,
  formatWeight,
} from "@/lib/units";
import type {
  CargoItem,
  LengthUnit,
  LoadMetrics,
  LoadingSide,
  Locale,
  Placement,
  WeightUnit,
} from "@/types";

/**
 * PNG-экспорт «текущего вида».
 *  - 3D: снимает WebGL-канвас (preserveDrawingBuffer + принудительный render)
 *    через реестр lib/export/capture.ts;
 *  - 2D: рисует свой светлый канвас (кузов, грузы item.color, размеры, легенда);
 *  - в обоих случаях поверх накладывается полоса метрик.
 *
 * Чистая геометрия вынесена в layoutRects/phaseRects — их покрывают тесты
 * (канвас в окружении vitest недоступен, рисование остаётся тонкой обёрткой).
 */

export interface OverlayLine {
  text: string;
}

/** Названия метрик, подставляемые в полосу (локализованы вызывающей стороной). */
export interface MetricsLabels {
  volume: string;
  weight: string;
  placed: string;
  bbox: string;
  layers: string;
  ldm: string;
  cog: string;
}

/** Строки полосы метрик PNG (и для PDF): {label}: {value}. */
export function buildMetricsOverlay(
  metrics: LoadMetrics,
  locale: Locale,
  units: { length: LengthUnit; weight: WeightUnit },
  labels: MetricsLabels
): string[] {
  const n = (v: number, d = 1) => formatNumber(v, d, locale);
  const len = (v: number) => formatLength(v, units.length, locale);
  const w = (kg: number) => formatWeight(kg, units.weight, locale);
  const vol = (m3: number) => `${formatVolume(m3, locale)} м³`;

  const bbox = metrics.bboxNoGaps;
  const cog = metrics.cog;
  return [
    `${labels.volume}: ${vol(metrics.volumeUsedM3)} / ${vol(metrics.volumeTotalM3)} · ${n(metrics.volumePct)} %`,
    `${labels.weight}: ${w(metrics.weightUsedKg)} / ${w(metrics.weightCapacityKg)} · ${n(metrics.weightPct)} %`,
    `${labels.placed}: ${n(metrics.placedCount, 0)} / ${n(metrics.totalCount, 0)}`,
    `${labels.bbox}: ${len(bbox.length)} × ${len(bbox.width)} × ${len(bbox.height)}`,
    `${labels.layers}: ${n(metrics.currentLayers, 0)} · ${labels.ldm}: ${n(metrics.ldm, 2)}`,
    `${labels.cog}: ${n(cog.longitudinalPct)} / ${n(cog.lateralPct)} %`,
  ];
}

/* ----------------------------- геометрия (pure) ----------------------------- */

export interface CanvasSize {
  w: number;
  h: number;
}

/** Прямоугольник в пикселях холста. */
export interface RectPx {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CargoRect extends RectPx {
  color: string;
  label: string;
}

export interface LegendRect {
  x: number;
  y: number;
  w: number;
  h: number;
  rows: Array<{ color: string; name: string; qty: number }>;
}

export interface LayoutRects {
  scale: number;
  ox: number;
  oy: number;
  body: RectPx;
  cargo: CargoRect[];
  legend: LegendRect;
}

export interface DrawLayoutOpts {
  size: CanvasSize;
  truck: { innerLength: number; innerWidth: number };
  items: CargoItem[];
  placements: Placement[];
  /** слои из layout-store: {index, z} */
  layers: Array<{ index: number; z: number }>;
  /** -1 = все слои (как в UI) */
  activeLayer: number;
  loadingSide: LoadingSide;
  locale: Locale;
  lengthUnit: LengthUnit;
  legendTitle: string;
}

const PAD = 64;

/** Видимые размещения для «текущего вида» (фильтр активного слоя). */
export function visibleForLayer(
  placements: Placement[],
  layers: Array<{ index: number; z: number }>,
  activeLayer: number
): Placement[] {
  if (activeLayer < 0) return placements;
  const layer = layers.find((l) => l.index === activeLayer);
  if (!layer) return placements;
  return placements.filter((p) => Math.abs(p.z - layer.z) < 1);
}

/** Расчёт пиксельной геометрии 2D-вида: кузов, грузы, легенда. */
export function layoutRects(opts: DrawLayoutOpts): LayoutRects {
  const { size, truck } = opts;
  const L = truck.innerLength;
  const W = truck.innerWidth;
  const scale = Math.max(
    0.0001,
    Math.min((size.w - PAD * 2) / L, (size.h - PAD * 2) / W)
  );
  const body: RectPx = {
    x: Math.round((size.w - L * scale) / 2),
    y: Math.round((size.h - W * scale) / 2),
    w: L * scale,
    h: W * scale,
  };

  const visible = visibleForLayer(opts.placements, opts.layers, opts.activeLayer);
  const itemById = new Map(opts.items.map((i) => [i.id, i]));

  const cargo: CargoRect[] = visible.map((p) => {
    const item = itemById.get(p.itemId);
    const d = item ? dimsFor(item, p.yaw, p.axis) : { dx: 1, dy: 1, dz: 1 };
    return {
      x: body.x + p.x * scale,
      y: body.y + p.y * scale,
      w: Math.max(1, d.dx * scale),
      h: Math.max(1, d.dy * scale),
      color: item?.color ?? "#8b8b8b",
      label: item?.name ?? "",
    };
  });

  // легенда: кол-во по каждому грузу в видимых размещениях (не более 8 строк)
  const counts = new Map<string, number>();
  for (const p of visible) {
    counts.set(p.itemId, (counts.get(p.itemId) ?? 0) + 1);
  }
  const rows = [...counts.entries()]
    .map(([id, qty]) => ({ item: itemById.get(id), qty }))
    .filter((r): r is { item: CargoItem; qty: number } => Boolean(r.item))
    .sort((a, b) => b.qty - a.qty);

  const row: LegendRect = legendRect(body, size.w);
  row.rows = rows
    .slice(0, 8)
    .map((r) => ({ color: r.item.color, name: r.item.name, qty: r.qty }));

  return { scale, ox: body.x, oy: body.y, body, cargo, legend: row };
}

/** Прямоугольник легенды в правом верхнем углу (не пересекает подписи размеров). */
function legendRect(body: RectPx, vw: number): LegendRect {
  const y = 20;
  const h = 12 + 8 * 18 + 12;
  const w = Math.min(280, Math.max(160, vw * 0.2));
  return {
    x: Math.max(body.x + body.w + 12, vw - w - 12),
    y,
    w,
    h,
    rows: [],
  };
}

/* ----------------------------- рисование ----------------------------- */

const FONT = "'Segoe UI', Roboto, system-ui, sans-serif";

function drawDoorMarker(
  ctx: CanvasRenderingContext2D,
  side: LoadingSide,
  body: RectPx
) {
  ctx.save();
  ctx.strokeStyle = "#0d9488";
  ctx.fillStyle = "#0d9488";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  if (side === "rear") {
    const cx = body.x + body.w;
    const y1 = body.y + body.h * 0.12;
    const y2 = body.y + body.h * 0.88;
    ctx.beginPath();
    ctx.moveTo(cx, y1);
    ctx.lineTo(cx, y2);
    ctx.stroke();
    const cy = (y1 + y2) / 2;
    ctx.beginPath();
    ctx.moveTo(cx + 6, cy);
    ctx.lineTo(cx + 22, cy - 10);
    ctx.lineTo(cx + 22, cy + 10);
    ctx.closePath();
    ctx.fill();
  } else if (side === "left" || side === "right") {
    const cy = side === "left" ? body.y : body.y + body.h;
    const x1 = body.x + body.w * 0.12;
    const x2 = body.x + body.w * 0.88;
    const cx = (x1 + x2) / 2;
    const dir = side === "left" ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(x1, cy);
    ctx.lineTo(x2, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy + dir * 6);
    ctx.lineTo(cx + 10, cy + dir * 6);
    ctx.lineTo(cx, cy + dir * 24);
    ctx.closePath();
    ctx.fill();
  } else if (side === "top") {
    ctx.setLineDash([10, 7]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(13,148,136,0.65)";
    ctx.strokeRect(body.x + 6, body.y + 6, body.w - 12, body.h - 12);
  }
  ctx.restore();
}

function drawDimensions(
  ctx: CanvasRenderingContext2D,
  opts: DrawLayoutOpts,
  rects: LayoutRects
) {
  const L = opts.truck.innerLength;
  const W = opts.truck.innerWidth;
  ctx.save();
  ctx.fillStyle = "#6b7280";
  ctx.font = `600 14px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(
    formatLength(L, opts.lengthUnit, opts.locale),
    opts.size.w / 2,
    rects.body.y - 10
  );
  ctx.save();
  ctx.translate(rects.body.x - 14, opts.size.h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = "bottom";
  ctx.fillText(
    formatLength(W, opts.lengthUnit, opts.locale),
    0,
    0
  );
  ctx.restore();
  ctx.restore();
}

/** Основное рисование 2D-вида на канвасе (светлый фон — под PNG/печать). */
export function drawLayout(
  ctx: CanvasRenderingContext2D,
  opts: DrawLayoutOpts
): LayoutRects {
  const rects = layoutRects(opts);

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, opts.size.w, opts.size.h);

  // кузов
  ctx.fillStyle = "#f4f2fb";
  ctx.fillRect(rects.body.x, rects.body.y, rects.body.w, rects.body.h);
  ctx.strokeStyle = "#6d5ae6";
  ctx.lineWidth = 2;
  ctx.strokeRect(rects.body.x, rects.body.y, rects.body.w, rects.body.h);

  drawDoorMarker(ctx, opts.loadingSide, rects.body);

  // грузы
  for (const r of rects.cargo) {
    ctx.fillStyle = r.color;
    ctx.globalAlpha = 0.82;
    ctx.beginPath();
    const radius = Math.min(6, r.h * 0.12);
    ctx.roundRect(r.x, r.y, r.w, r.h, radius);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(8,5,18,0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
    if (r.w > 72 && r.h > 28) {
      ctx.fillStyle = "rgba(8,5,18,0.8)";
      ctx.font = `600 12px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label =
        r.label.length > 14 ? `${r.label.slice(0, 13)}…` : r.label;
      ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2, r.w - 10);
    }
  }

  drawDimensions(ctx, opts, rects);

  // легенда
  if (rects.legend.rows.length > 0) {
    const lg = rects.legend;
    ctx.save();
    ctx.globalAlpha = 0.94;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(lg.x, lg.y, lg.w, lg.h, 10);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(109,90,230,0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#241f3d";
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(opts.legendTitle, lg.x + 12, lg.y + 7);
    ctx.font = `500 12px ${FONT}`;
    lg.rows.forEach((row, i) => {
      const ry = lg.y + 24 + i * 18;
      ctx.fillStyle = row.color;
      ctx.fillRect(lg.x + 12, ry + 3, 11, 11);
      ctx.fillStyle = "#241f3d";
      const name = row.name.length > 26 ? `${row.name.slice(0, 25)}…` : row.name;
      ctx.fillText(name, lg.x + 30, ry, lg.w - 30 - 58);
      ctx.textAlign = "right";
      ctx.fillText(`×${row.qty}`, lg.x + lg.w - 12, ry);
      ctx.textAlign = "left";
    });
    ctx.restore();
  }

  ctx.restore();
  return rects;
}

/* ----------------------------- полоса метрик ----------------------------- */

export const OVERLAY_FONT = `600 16px ${FONT}`;

/** Накладывает полупрозрачную белую полосу с метриками (16–18px). */
export function drawOverlayStrip(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lines: string[]
): void {
  const COLUMNS = 3;
  const rows = Math.max(1, Math.ceil(lines.length / COLUMNS));
  const lineH = 26;
  const stripH = 14 + rows * lineH + 10;
  const y0 = h - stripH;

  ctx.save();
  ctx.globalAlpha = 0.93;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, y0, w, stripH);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(36,31,61,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y0);
  ctx.lineTo(w, y0);
  ctx.stroke();

  let font = OVERLAY_FONT;
  if (lines.length > 0) {
    ctx.font = font;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (widest > (w * 0.96) / COLUMNS) {
      font = `600 14px ${FONT}`;
    }
  }
  ctx.fillStyle = "#241f3d";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  lines.forEach((line, i) => {
    const col = i % COLUMNS;
    const row = Math.floor(i / COLUMNS);
    const colW = w / COLUMNS;
    ctx.font = font;
    ctx.fillText(line, col * colW + colW / 2, y0 + 18 + row * lineH);
  });
  ctx.restore();
}

/* ----------------------------- экспорт ----------------------------- */

export interface RenderPngInput {
  viewMode: "2d" | "3d";
  /** размер канваса для 2D (для 3D берётся размер WebGL-канваса) */
  size: CanvasSize;
  layout: DrawLayoutOpts;
  overlayLines: string[];
}

/** Формирует PNG (dataURL) «текущего вида» с полосой метрик. Браузерный API. */
export function renderPng(input: RenderPngInput): string {
  let canvas: HTMLCanvasElement;
  if (input.viewMode === "3d") {
    const gl = getCapturedGL();
    if (!gl) throw new Error("3D canvas is not available");
    gl.render();
    canvas = gl.canvas;
  } else {
    canvas = document.createElement("canvas");
    canvas.width = input.size.w;
    canvas.height = input.size.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context is not available");
    drawLayout(ctx, input.layout);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context is not available");
  drawOverlayStrip(ctx, canvas.width, canvas.height, input.overlayLines);
  return canvas.toDataURL("image/png");
}

/** Триггер скачивания dataURL. */
export function downloadDataUrl(dataUrl: string, fileName: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}