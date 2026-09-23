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

export interface ViewZones {
  /** легенда грузов — низ-право */
  legend: PxRect;
}

/**
 * Зоны размещения легенды (подписи размеров кузова считаются относительно
 * прямоугольника кузова в dimLabels, см. ТЗ B2).
 */
export function computeViewZones(vw: number, vh: number, rowCount: number): ViewZones {
  const legendW = Math.min(LEGEND.maxWidth, Math.max(LEGEND.minWidth, Math.round(vw * 0.34)));
  const legendH =
    LEGEND.headerH + Math.min(Math.max(rowCount, 1), 6) * LEGEND.rowH + LEGEND.margin;

  return {
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

/* ------------------- подписи размеров, привязанные к кузову ------------------- */

export interface BodyRect {
  ox: number;
  oy: number;
  w: number;
  h: number;
}

export interface DimLabelPos {
  /** подпись длины — по центру над верхней кромкой кузова */
  len: { x: number; y: number; fontSize: number };
  /** подпись ширины — слева от кузова (повёрнута на -90°) */
  wid: { x: number; y: number; fontSize: number };
  /** фактический отступ подписи от кромки кузова, px (8–12 по ТЗ B2) */
  offset: number;
}

export const DIM_LABEL = {
  /** отступ от кромки кузова, px */
  offset: 10,
  /** обычный шрифт подписей, px */
  font: 12,
  /** минимальный шрифт, если подпись не помещается, px */
  fontMin: 11,
  /** оценка средней ширины глифа относительно кегля */
  charFactor: 0.62,
} as const;

/** Оценка ширины текста в px (для подбора шрифта подписи). */
export function estTextWidth(
  text: string,
  fontSize: number,
  factor = DIM_LABEL.charFactor
): number {
  return text.length * fontSize * factor;
}

/**
 * ТЗ B2: подписи размеров привязаны к прямоугольнику КУЗОВА, а не к вьюпорту.
 * Длина — по центру над верхней кромкой, ширина — слева по вертикали; отступ
 * от кромки 8–12 px сохраняется при любом масштабе/размере окна. Если текст
 * шире кузова — шрифт уменьшается до 11px, но подпись не отрывается от кузова.
 */
export function dimLabels(body: BodyRect, lenText: string, widText: string): DimLabelPos {
  const lenFont = estTextWidth(lenText, DIM_LABEL.font) <= body.w ? DIM_LABEL.font : DIM_LABEL.fontMin;
  const widFont = estTextWidth(widText, DIM_LABEL.font) <= body.h ? DIM_LABEL.font : DIM_LABEL.fontMin;
  return {
    len: { x: body.ox + body.w / 2, y: body.oy - DIM_LABEL.offset, fontSize: lenFont },
    wid: { x: body.ox - DIM_LABEL.offset, y: body.oy + body.h / 2, fontSize: widFont },
    offset: DIM_LABEL.offset,
  };
}
