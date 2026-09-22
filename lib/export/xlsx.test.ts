import { describe, expect, it } from "vitest";
import { utils, type WorkBook } from "xlsx";

import { computeMetrics } from "@/lib/advanced/metrics";
import { buildWorkbook, type XlsxTexts } from "@/lib/export/xlsx";
import type { CargoItem, LoadMetrics, LoadStop, Placement, VehicleSpec } from "@/types";

const vehicle: VehicleSpec = {
  id: "test",
  name: "Тест",
  nameEn: "Test",
  builtin: false,
  innerLength: 1000,
  innerWidth: 1000,
  innerHeight: 1000,
  payload: 1000,
  tare: 200,
  axles: [
    { id: "f", label: "Передняя", position: 200, maxLoad: 600, tareShare: 0.4 },
    { id: "r", label: "Задняя", position: 800, maxLoad: 800, tareShare: 0.6 },
  ],
  axleLayout: "rigid",
  loadingSides: ["rear", "right", "left", "top"],
  defaultLoadingSide: "rear",
  bodyType: "tent",
};

const item: CargoItem = {
  id: "a",
  name: "Ящик",
  shape: "box",
  length: 500,
  width: 500,
  height: 500,
  diameter: 0,
  weight: 100,
  quantity: 2,
  stackable: true,
  maxTopLoad: 1000,
  group: "general",
  color: "#8B5CF6",
  cylinderAxis: "up",
  stopIndex: 0,
};

const placements: Placement[] = [
  {
    id: "p0",
    itemId: "a",
    unitIndex: 0,
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    axis: "up",
    stopIndex: 0,
  },
  {
    id: "p1",
    itemId: "a",
    unitIndex: 1,
    x: 0,
    y: 0,
    z: 500,
    yaw: 0,
    axis: "up",
    stopIndex: 0,
  },
];

const stops: LoadStop[] = [
  { id: "s0", name: "Склад 1" },
  { id: "s1", name: "Склад 2" },
];

const gaps = { wall: 10, rowWidth: 10, rowLength: 20 };
const gapsByMode = { along: gaps, cross: gaps, mixed: gaps };

const metrics: LoadMetrics | null = computeMetrics({
  items: [item],
  placements,
  unplaced: [],
  vehicle,
  mode: "along",
  gaps,
});

const texts: XlsxTexts = {
  sheets: { params: "Параметры", goods: "Грузы", gaps: "Зазоры", layout: "Раскладка" },
  mode: { along: "Вдоль", cross: "Поперёк", mixed: "Смешанный" },
  yes: "Да",
  no: "Нет",
  shape: { box: "Короб", cylinder: "Бочка", oversize: "Негабарит" },
  axis: { up: "Лежа", side: "Стоя" },
  labels: {
    vehicle: "Транспорт",
    dims: "Размеры",
    payload: "Грузоподъёмность",
    mode: "Режим",
    wall: "Зазор стен",
    rowWidth: "Зазор ширины",
    rowLength: "Зазор длины",
    stacking: "Штабелирование",
    lifo: "LIFO",
    maxLayers: "Макс. слоёв",
    loadingSide: "Сторона загрузки",
    side: { rear: "Задняя", left: "Левая", right: "Правая", top: "Верхняя" },
    name: "Название",
    type: "Тип",
    length: "Длина",
    width: "Ширина",
    height: "Высота",
    diameter: "Диаметр",
    weight: "Вес",
    quantity: "Количество",
    stackable: "Штабелируемый",
    group: "Группа",
    color: "Цвет",
    stop: "Остановка",
    x: "X",
    y: "Y",
    z: "Z",
    yaw: "Поворот",
    axis: "Ориентация",
    size: "Размер",
    placed: "Размещено",
    used: "Занятая",
    volume: "Объём",
    bbox: "Габариты укладки",
    layers: "Слои",
    ldm: "LDM",
    cog: "ЦТ",
    axles: "Оси",
  },
};

function aoa(ws: WorkBook["Sheets"][string]) {
  return utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
}

describe("xlsx.buildWorkbook", () => {
  const wb = buildWorkbook(
    {
      items: [item],
      placements,
      unplaced: [{ itemId: "a", quantity: 0, reason: "no-space" }],
      vehicle,
      mode: "along",
      gaps,
      gapsByMode,
      stacking: true,
      lifo: true,
      maxLayers: 2,
      loadingSide: "rear",
      stops,
      activeLayer: -1,
      layers: [
        { index: 0, z: 0 },
        { index: 1, z: 500 },
      ],
      metrics,
      locale: "ru",
      lengthUnit: "mm",
      weightUnit: "kg",
      generatedAt: "2026-01-01T12:00:00.000Z",
    },
    texts
  );

  it("содержит листы всех четырёх разделов", () => {
    expect(wb.SheetNames).toHaveLength(4);
    expect(wb.SheetNames[0]).toBe("Параметры");
    expect(wb.SheetNames[1]).toBe("Грузы");
    expect(wb.SheetNames[2]).toBe("Зазоры");
    expect(wb.SheetNames[3]).toBe("Раскладка вдоль");
  });

  it("пишет параметры с числовыми значениями", () => {
    const rows = aoa(wb.Sheets["Параметры"]);
    const vehicleRow = rows.find((r) => r[0] === "Транспорт");
    expect(vehicleRow?.[1]).toBe("Тест");
    const payloadRow = rows.find((r) => r[0] === "Грузоподъёмность");
    expect(typeof payloadRow?.[1]).toBe("number");
    expect(payloadRow?.[1]).toBe(1000);
    const modeRow = rows.find((r) => r[0] === "Режим");
    expect(modeRow?.[1]).toBe("Вдоль");
  });

  it("пишет грузы с числовыми габаритами и количеством", () => {
    const rows = aoa(wb.Sheets["Грузы"]);
    const row = rows[1];
    expect(row[0]).toBe("Ящик");
    expect(row[1]).toBe("Короб");
    for (const col of [2, 3, 4, 5, 6, 7]) {
      expect(typeof row[col]).toBe("number");
    }
    expect(row[7]).toBe(2);
    expect(row[8]).toBe("Да");
  });

  it("пишет зазоры для всех трёх режимов", () => {
    const rows = aoa(wb.Sheets["Зазоры"]);
    expect(rows).toHaveLength(4);
    expect(rows[1]).toEqual(["Вдоль", 10, 10, 20]);
    expect(rows[3]).toEqual(["Смешанный", 10, 10, 20]);
  });

  it("пишет раскладку числом на строку с адресами и размером", () => {
    const rows = aoa(wb.Sheets["Раскладка вдоль"]);
    expect(rows[0].slice(2, 5)).toEqual(["X, мм", "Y, мм", "Z, мм"]);
    expect(rows).toHaveLength(3); // шапка + 2 размещения
    const r1 = rows[1];
    expect(r1[1]).toBe("Ящик");
    for (const col of [0, 2, 3, 4, 9]) {
      expect(typeof r1[col]).toBe("number");
    }
    expect(r1[7]).toBe("500×500×500");
    expect(r1[8]).toBe("Склад 1");
  });
});