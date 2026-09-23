import type { CargoShape, CylinderAxis, Yaw } from "@/types";

/** Минимальный набор полей, нужный для геометрии. */
export interface Geom {
  shape: CargoShape;
  /** мм: L (для цилиндра — длина обечаики) */
  length: number;
  /** мм: W */
  width: number;
  /** мм: H */
  height: number;
  /** мм: Ø цилиндра */
  diameter: number;
}

export interface Dims {
  dx: number;
  dy: number;
  dz: number;
}

/**
 * Габариты одной единицы в осях кузова.
 * X — длина кузова, Y — ширина, Z — высота.
 *
 * - box/oversize: yaw 90° — поворот вокруг вертикальной оси (поперёк).
 * - цилиндр axis=up: стоит на торце → Ø×Ø по XY, высота L.
 * - цилиндр axis=side: лежит → L×Ø по XY (при yaw=90 — Ø×L), высота Ø.
 */
export function dimsFor(geom: Geom, yaw: Yaw, axis: CylinderAxis): Dims {
  if (geom.shape === "cylinder") {
    const d = geom.diameter;
    const l = geom.length;
    if (axis === "up") {
      return { dx: d, dy: d, dz: l };
    }
    // лёжа: образующая вдоль X при yaw=0
    return yaw === 90 ? { dx: d, dy: l, dz: d } : { dx: l, dy: d, dz: d };
  }
  return yaw === 90
    ? { dx: geom.width, dy: geom.length, dz: geom.height }
    : { dx: geom.length, dy: geom.width, dz: geom.height };
}

/** «Базовая» ориентация без поворота — для сравнения и подбора режимов. */
export function dimsBase(geom: Geom): Dims {
  return dimsFor(geom, 0, geom.shape === "cylinder" ? "up" : "up");
}

/**
 * Форма груза в виде сверху: вертикальный цилиндр (стоит на торце) — круг,
 * всё остальное (коробки, лёжащие цилиндры) — прямоугольник.
 */
export function topViewShape(
  geom: Geom,
  axis: CylinderAxis
): "circle" | "rect" {
  return geom.shape === "cylinder" && axis === "up" ? "circle" : "rect";
}

/** Объём одной единицы, мм³. */
export function unitVolume(geom: Geom): number {
  const { dx, dy, dz } = dimsBase(geom);
  return dx * dy * dz;
}

/**
 * Возможные ориентации единицы в зависимости от режима раскладки.
 * along — только вдоль (yaw 0), cross — только поперёк (yaw 90),
 * mixed — обе (+ вертикальный цилиндр).
 */
export function orientationsFor(
  geom: Geom,
  mode: "along" | "cross" | "mixed"
): Array<{ yaw: Yaw; axis: CylinderAxis }> {
  if (geom.shape === "cylinder") {
    const side: Yaw = mode === "cross" ? 90 : 0;
    if (mode === "mixed") {
      return [
        { yaw: 0, axis: "up" },
        { yaw: 0, axis: "side" },
        { yaw: 90, axis: "side" },
      ];
    }
    return [
      { yaw: 0, axis: "up" },
      { yaw: side, axis: "side" },
    ];
  }
  if (mode === "cross") return [{ yaw: 90, axis: "up" }];
  if (mode === "mixed") return [{ yaw: 0, axis: "up" }, { yaw: 90, axis: "up" }];
  return [{ yaw: 0, axis: "up" }];
}
