import { COLLISION_EPS } from "@/lib/constants";
import { dimsFor, type Geom } from "@/lib/geometry";
import type { Placement } from "@/types";

export interface Box3 {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
}

export interface ContainerBox {
  dx: number;
  dy: number;
  dz: number;
}

/**
 * Строгое пересечение (касание граней разрешено: при touch равенство
 * не даёт >, при пересечении меньше допуска eps считаем касанием).
 */
export function overlaps(a: Box3, b: Box3, eps = COLLISION_EPS): boolean {
  return (
    a.x < b.x + b.dx - eps &&
    a.x + a.dx > b.x + eps &&
    a.y < b.y + b.dy - eps &&
    a.y + a.dy > b.y + eps &&
    a.z < b.z + b.dz - eps &&
    a.z + a.dz > b.z + eps
  );
}

export function placementBox(
  geom: Geom,
  p: Pick<Placement, "x" | "y" | "z" | "yaw" | "axis">
): Box3 {
  const { dx, dy, dz } = dimsFor(geom, p.yaw, p.axis);
  return { x: p.x, y: p.y, z: p.z, dx, dy, dz };
}

/** Боксы всех размещений (по карте геометрий item.id → Geom). */
export function boxesFor(
  placements: Placement[],
  geomById: Map<string, Geom>,
  excludePlacementIds?: ReadonlySet<string>
): Box3[] {
  const out: Box3[] = [];
  for (const p of placements) {
    if (excludePlacementIds?.has(p.id)) continue;
    const geom = geomById.get(p.itemId);
    if (!geom) continue;
    out.push(placementBox(geom, p));
  }
  return out;
}

export function anyOverlap(candidate: Box3, others: Box3[]): boolean {
  for (const o of others) {
    if (overlaps(candidate, o)) return true;
  }
  return false;
}

/** Кандидат полностью внутри кузова (с допуском на касание стен). */
export function insideContainer(b: Box3, c: ContainerBox, eps = COLLISION_EPS): boolean {
  return (
    b.x >= -eps &&
    b.y >= -eps &&
    b.z >= -eps &&
    b.x + b.dx <= c.dx + eps &&
    b.y + b.dy <= c.dy + eps &&
    b.z + b.dz <= c.dz + eps
  );
}

/**
 * Доля площади дна кандидата, которая опирается на что-либо
 * (пол при z≈0 или верхние грани других боксов с допуском 1 мм).
 */
export function supportRatio(b: Box3, others: Box3[], eps = 1): number {
  if (b.z <= eps) return 1; // на полу
  const samples: Array<[number, number]> = [
    [0.1, 0.1],
    [0.9, 0.1],
    [0.1, 0.9],
    [0.9, 0.9],
    [0.5, 0.5],
  ];
  let supported = 0;
  for (const [fx, fy] of samples) {
    const px = b.x + b.dx * fx;
    const py = b.y + b.dy * fy;
    for (const o of others) {
      const top = o.z + o.dz;
      if (
        Math.abs(top - b.z) <= eps &&
        px >= o.x - eps &&
        px <= o.x + o.dx + eps &&
        py >= o.y - eps &&
        py <= o.y + o.dy + eps
      ) {
        supported++;
        break;
      }
    }
  }
  return supported / samples.length;
}

export type MoveRejection = "overlap" | "bounds" | "support";

export interface MoveValidation {
  ok: boolean;
  reason?: MoveRejection;
}

/**
 * Валидация ручного перемещения: пересечение запрещено (касание ок),
 * границы кузова, при смене высоты — наличие опоры ≥ 50%.
 */
export function validateMove(
  candidate: Box3,
  others: Box3[],
  container: ContainerBox,
  checkSupport: boolean
): MoveValidation {
  if (!insideContainer(candidate, container)) return { ok: false, reason: "bounds" };
  if (anyOverlap(candidate, others)) return { ok: false, reason: "overlap" };
  if (checkSupport && supportRatio(candidate, others) < 0.5) {
    return { ok: false, reason: "support" };
  }
  return { ok: true };
}
