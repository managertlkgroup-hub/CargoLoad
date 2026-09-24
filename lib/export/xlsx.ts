import { utils, writeFile, type WorkBook } from "xlsx";

import { dimsFor } from "@/lib/geometry";
import { formatLength, formatVolume } from "@/lib/units";
import type { ExportModel } from "@/lib/export/model";
import type { PackMode } from "@/types";

/**
 * Экспорт раскладки в Excel (.xlsx).
 * Листы: «Параметры», «Грузы», «Зазоры», «Раскладка {режим}».
 * Числовые ячейки пишутся числами (мм/кг целые, м³ с 2 знаками).
 * xlsx.js подключается через динамический импорт hooks/use-export.ts.
 */

export interface XlsxAxisLabels {
  up: string;
  side: string;
}

export interface XlsxTexts {
  sheets: { params: string; goods: string; gaps: string; layout: string };
  mode: Record<PackMode, string>;
  yes: string;
  no: string;
  shape: { box: string; cylinder: string; oversize: string };
  axis: XlsxAxisLabels;
  labels: {
    vehicle: string;
    dims: string;
    payload: string;
    mode: string;
    wall: string;
    rowWidth: string;
    rowLength: string;
    stacking: string;
    lifo: string;
    maxLayers: string;
    loadingSide: string;
    side: { rear: string; left: string; right: string; top: string };
    name: string;
    type: string;
    length: string;
    width: string;
    height: string;
    diameter: string;
    weight: string;
    quantity: string;
    stackable: string;
    group: string;
    color: string;
    stop: string;
    x: string;
    y: string;
    z: string;
    yaw: string;
    axis: string;
    size: string;
    placed: string;
    used: string;
    volume: string;
    bbox: string;
    layers: string;
    ldm: string;
    cog: string;
    axles: string;
  };
}

/** Числа: мм/кг целыми, объёмы — 2 знака. */
function num(v: number, digits = 0): number {
  if (!Number.isFinite(v)) return 0;
  const f = 10 ** digits;
  return Math.round((v + Number.EPSILON) * f) / f;
}

function sheetFromAoa(aoa: unknown[][], widths?: number[]) {
  const ws = utils.aoa_to_sheet(aoa);
  if (widths) {
    ws["!cols"] = widths.map((wch) => ({ wch }));
  }
  return ws;
}

/** Собирает книгу из снапшота раскладки (чистая функция — покрыта тестами). */
export function buildWorkbook(model: ExportModel, tx: XlsxTexts): WorkBook {
  const { mode } = model;
  const wb = utils.book_new();

  /* — Параметры — */
  const paramsAoa: (string | number)[][] = [];
  paramsAoa.push([tx.labels.vehicle, model.vehicle.name]);
  paramsAoa.push([
    tx.labels.dims,
    `${formatLength(model.vehicle.innerLength, model.lengthUnit, model.locale)} × ${formatLength(model.vehicle.innerWidth, model.lengthUnit, model.locale)} × ${formatLength(model.vehicle.innerHeight, model.lengthUnit, model.locale)}`,
  ]);
  paramsAoa.push([tx.labels.payload, num(model.vehicle.payload)]);
  paramsAoa.push([tx.labels.mode, tx.mode[mode]]);
  paramsAoa.push([tx.labels.wall, num(model.gaps.wall)]);
  paramsAoa.push([tx.labels.rowWidth, num(model.gaps.rowWidth)]);
  paramsAoa.push([tx.labels.rowLength, num(model.gaps.rowLength)]);
  paramsAoa.push([tx.labels.stacking, model.stacking ? tx.yes : tx.no]);
  paramsAoa.push([tx.labels.lifo, model.lifo ? tx.yes : tx.no]);
  paramsAoa.push([tx.labels.maxLayers, num(model.maxLayers)]);
  paramsAoa.push([tx.labels.loadingSide, tx.labels.side[model.loadingSide]]);

  const m = model.metrics;
  if (m) {
    paramsAoa.push([
      tx.labels.volume,
      `${formatVolume(m.volumeUsedM3, model.locale)} / ${formatVolume(m.volumeTotalM3, model.locale)} м³ (${num(m.volumePct, 1)} %)`,
    ]);
    paramsAoa.push([
      `${tx.labels.used} ${tx.labels.weight}`,
      `${num(m.weightUsedKg)} / ${num(m.weightCapacityKg)} кг (${num(m.weightPct, 1)} %)`,
    ]);
    paramsAoa.push([tx.labels.placed, `${num(m.placedCount)} / ${num(m.totalCount)}`]);
    paramsAoa.push([
      tx.labels.bbox,
      `${formatLength(m.bboxNoGaps.length, model.lengthUnit, model.locale)} × ${formatLength(m.bboxNoGaps.width, model.lengthUnit, model.locale)} × ${formatLength(m.bboxNoGaps.height, model.lengthUnit, model.locale)}`,
    ]);
    paramsAoa.push([tx.labels.layers, num(m.currentLayers)]);
    paramsAoa.push([tx.labels.ldm, num(m.ldm, 2)]);
    paramsAoa.push([tx.labels.cog, `${num(m.cog.longitudinalPct, 1)} / ${num(m.cog.lateralPct, 1)} %`]);
    if (m.axles.length > 0) {
      paramsAoa.push([
        tx.labels.axles,
        m.axles.map((a) => `${a.label}: ${num(a.loadKg)}/${num(a.maxLoadKg)} кг`).join("; "),
      ]);
    }
  }
  utils.book_append_sheet(wb, sheetFromAoa(paramsAoa, [32, 60]), tx.sheets.params);

  /* — Грузы — */
  const goodsAoa: (string | number)[][] = [
    [
      tx.labels.name,
      tx.labels.type,
      `${tx.labels.length}, мм`,
      `${tx.labels.width}, мм`,
      `${tx.labels.height}, мм`,
      `${tx.labels.diameter}, мм`,
      `${tx.labels.weight}, кг`,
      tx.labels.quantity,
      tx.labels.stackable,
      tx.labels.group,
      tx.labels.color,
    ],
  ];
  for (const item of model.items) {
    goodsAoa.push([
      item.name,
      tx.shape[item.shape] ?? tx.shape.box,
      num(item.length),
      num(item.width),
      num(item.height),
      num(item.diameter),
      num(item.weight),
      num(item.quantity),
      item.stackable ? tx.yes : tx.no,
      item.group,
      item.color,
    ]);
  }
  utils.book_append_sheet(
    wb,
    sheetFromAoa(goodsAoa, [24, 12, 8, 8, 8, 8, 10, 10, 12, 12, 10]),
    tx.sheets.goods
  );

  /* — Зазоры (все режимы) — */
  const gapModes: PackMode[] = ["along", "cross", "mixed"];
  const gapsAoa: (string | number)[][] = [
    [tx.labels.mode, `${tx.labels.wall}, мм`, `${tx.labels.rowWidth}, мм`, `${tx.labels.rowLength}, мм`],
  ];
  for (const gm of gapModes) {
    const g = model.gapsByMode[gm];
    gapsAoa.push([tx.mode[gm], num(g.wall), num(g.rowWidth), num(g.rowLength)]);
  }
  utils.book_append_sheet(
    wb,
    sheetFromAoa(gapsAoa, [16, 14, 16, 16]),
    tx.sheets.gaps
  );

  /* — Раскладка (текущий режим) — */
  const itemById = new Map(model.items.map((i) => [i.id, i]));
  const layoutAoa: (string | number)[][] = [
    [
      "#",
      tx.labels.name,
      `${tx.labels.x}, мм`,
      `${tx.labels.y}, мм`,
      `${tx.labels.z}, мм`,
      tx.labels.yaw,
      tx.labels.axis,
      `${tx.labels.size} (Д×Ш×В), мм`,
      tx.labels.stop,
      `${tx.labels.weight}, кг`,
    ],
  ];
  model.placements.forEach((p, i) => {
    const item = itemById.get(p.itemId);
    if (!item) return;
    const d = dimsFor(item, p.yaw, p.axis);
    layoutAoa.push([
      num(i + 1),
      item.name,
      num(p.x),
      num(p.y),
      num(p.z),
      p.yaw,
      p.axis === "up" ? tx.axis.up : tx.axis.side,
      `${num(d.dx)}×${num(d.dy)}×${num(d.dz)}`,
      model.stops[p.stopIndex]?.name ?? String(p.stopIndex + 1),
      num(item.weight),
    ]);
  });
  utils.book_append_sheet(
    wb,
    sheetFromAoa(layoutAoa, [4, 24, 10, 10, 10, 8, 10, 22, 16, 10]),
    `${tx.sheets.layout} ${tx.mode[mode].toLowerCase()}`
  );

  return wb;
}

/** Запись файла (браузер). */
export function exportExcel(model: ExportModel, tx: XlsxTexts, fileName: string): void {
  writeFile(buildWorkbook(model, tx), fileName);
}