import { SNAP_THRESHOLD } from "@/lib/constants";
import type { Box3 } from "@/lib/packing/collide";

export interface SnapContext {
  /** внутренние габариты кузова */
  L: number;
  W: number;
  /** зазор от стен */
  wall: number;
  /** габариты перемещаемого груза */
  dx: number;
  dy: number;
  /** остальные боксы того же слоя (для примагничивания к рёбрам) */
  others: Box3[];
  /** шаг сетки, мм */
  grid: number;
  enabled: boolean;
  threshold?: number;
}

interface AxisCandidate {
  value: number;
  dist: number;
}

function bestAxis(
  raw: number,
  candidates: number[],
  threshold: number
): number | null {
  let best: AxisCandidate | null = null;
  for (const c of candidates) {
    const dist = Math.abs(c - raw);
    if (dist <= threshold && (!best || dist < best.dist)) {
      best = { value: c, dist };
    }
  }
  return best ? best.value : null;
}

/**
 * Примагничивание: сетка + притяжение к стенкам кузова и к рёбрам соседей
 * (в пределах threshold по каждой оси независимо). Позиция всегда целая.
 */
export function snapPosition(rawX: number, rawY: number, ctx: SnapContext): {
  x: number;
  y: number;
} {
  const threshold = ctx.threshold ?? SNAP_THRESHOLD;
  const grid = Math.max(1, Math.round(ctx.grid));

  if (!ctx.enabled) {
    return { x: Math.round(rawX), y: Math.round(rawY) };
  }

  const gridRound = (v: number) => Math.round(v / grid) * grid;

  /* — ось X: стены [wall, L−wall−dx] + рёбра соседей — */
  const xCands = [gridRound(rawX), ctx.wall, ctx.L - ctx.wall - ctx.dx];
  for (const o of ctx.others) {
    xCands.push(o.x + o.dx, o.x - ctx.dx, o.x, o.x + o.dx - ctx.dx);
  }
  const snappedX = bestAxis(rawX, xCands, threshold) ?? gridRound(rawX);

  /* — ось Y — */
  const yCands = [gridRound(rawY), ctx.wall, ctx.W - ctx.wall - ctx.dy];
  for (const o of ctx.others) {
    yCands.push(o.y + o.dy, o.y - ctx.dy, o.y, o.y + o.dy - ctx.dy);
  }
  const snappedY = bestAxis(rawY, yCands, threshold) ?? gridRound(rawY);

  return { x: Math.round(snappedX), y: Math.round(snappedY) };
}
