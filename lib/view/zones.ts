/** Пиксельные прямоугольники зон2D-вида. */

export interface PxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const LEGEND = {
  maxWidth: 240,
  minWidth: 150,
  headerH: 26,
  rowH: 20,
  margin: 10,
} as const;

export const DIMS = {
  topW: 220,
  topH: 18,
  leftW: 18,
  leftH: 130,
  margin: 6,
} as const;

export interface ViewZones {
  /** подпись длины кузова — верх по центру */
  dimsTop: PxRect;
  /** подпись ширины кузова — слева по центру (вертикально) */
  dimsLeft: PxRect;
  /** легенда грузов — низ-право */
  legend: PxRect;
}

/**
 * Зоны размещения подписей и легенды. Инвариант (покрыт тестом):
 * легенда не пересекается ни с подписью длины, ни с подписью ширины —
 * классический баг прошлой версии (легенда налезала на подпись) исключён.
 */
export function computeViewZones(vw: number, vh: number, rowCount: number): ViewZones {
  const legendW = Math.min(LEGEND.maxWidth, Math.max(LEGEND.minWidth, Math.round(vw * 0.34)));
  const legendH =
    LEGEND.headerH + Math.min(Math.max(rowCount, 1), 6) * LEGEND.rowH + LEGEND.margin;

  return {
    dimsTop: {
      x: Math.round(vw / 2 - DIMS.topW / 2),
      y: DIMS.margin,
      w: DIMS.topW,
      h: DIMS.topH,
    },
    dimsLeft: {
      x: DIMS.margin,
      y: Math.round(vh / 2 - DIMS.leftH / 2),
      w: DIMS.leftW,
      h: DIMS.leftH,
    },
    legend: {
      x: vw - legendW - LEGEND.margin,
      y: vh - legendH - LEGEND.margin,
      w: legendW,
      h: legendH,
    },
  };
}

/** Пересечение с ненулевой площадью (касание граней — не пересечение). */
export function rectsIntersect(a: PxRect, b: PxRect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}
