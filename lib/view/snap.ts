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

export type SnapSide = "start" | "end";

/** Какая сторона груза примагнитилась (к ребру соседа или к стенке). */
export interface SnapAlign {
  axis: "x" | "y";
  side: SnapSide;
}

export interface SnapResult {
  x: number;
  y: number;
  /**
   * Сторона примагниченного края для подсветки; null — снап не сработал
   * (свободное пространство, чистая сетка либо магнит выключен).
   */
  align: SnapAlign | null;
}

interface AxisCand {
  value: number;
  align: SnapAlign | null;
}

function bestCand(
  raw: number,
  cands: AxisCand[],
  threshold: number
): AxisCand | null {
  let best: AxisCand | null = null;
  for (const c of cands) {
    const dist = Math.abs(c.value - raw);
    if (dist >= threshold) continue;
    const bestDist = best ? Math.abs(best.value - raw) : Infinity;
    if (
      !best ||
      dist < bestDist ||
      // одинаковая дистанция: ребро/стена важнее сетки (для подсветки)
      (dist === bestDist && c.align && !best.align)
    ) {
      best = c;
    }
  }
  return best;
}

function snapAxis(
  raw: number,
  size: number,
  wallStart: number,
  wallEnd: number,
  gridRound: number,
  others: Box3[],
  axis: "x" | "y",
  threshold: number
): { value: number; align: SnapAlign | null } {
  /* ТЗ B1: примагничивание включается ТОЛЬКО когда груз ближе threshold
     (по оси) к стене кузова или к ребру соседа. В свободном пространстве
     груз свободно следует за мышью — никакого снапа. */
  let near = Math.min(
    Math.abs(raw - wallStart),
    Math.abs(raw + size - wallEnd)
  );
  for (const o of others) {
    const oStart = axis === "x" ? o.x : o.y;
    const oSize = axis === "x" ? o.dx : o.dy;
    const oEnd = oStart + oSize;
    near = Math.min(
      near,
      Math.abs(raw - oEnd), // левая(верхняя) кромка груза к правой(нижней) соседа
      Math.abs(raw + size - oStart), // правая(нижняя) кромка груза к левой(верхней) соседа
      Math.abs(raw - oStart), // выравнивание левых(верхних) кромок
      Math.abs(raw + size - oEnd) // выравнивание правых(нижних) кромок
    );
  }
  if (near >= threshold) {
    // свободное пространство: груз свободно следует за мышью, без снапа
    return { value: Math.round(raw), align: null };
  }

  const cands: AxisCand[] = [
    { value: gridRound, align: null },
    { value: wallStart, align: { axis, side: "start" } },
    { value: wallEnd - size, align: { axis, side: "end" } },
  ];
  for (const o of others) {
    const oStart = axis === "x" ? o.x : o.y;
    const oSize = axis === "x" ? o.dx : o.dy;
    const oEnd = oStart + oSize;
    cands.push(
      { value: oEnd, align: { axis, side: "start" } },
      { value: oStart - size, align: { axis, side: "end" } },
      { value: oStart, align: { axis, side: "start" } },
      { value: oEnd - size, align: { axis, side: "end" } }
    );
  }
  return bestCand(raw, cands, threshold) ?? { value: gridRound, align: null };
}

/**
 * Примагничивание: к сетке, стенкам кузова и рёбрам соседей. По ТЗ B1 снап
 * срабатывает только когда груз приблизился к краю соседа/стене на расстояние
 * < порога (50 мм); в свободном пространстве возвращается округлённая позиция.
 * Если магнит выключен — только округление, без примагничивания.
 */
export function snapPosition(rawX: number, rawY: number, ctx: SnapContext): SnapResult {
  const threshold = ctx.threshold ?? SNAP_THRESHOLD;
  const grid = Math.max(1, Math.round(ctx.grid));

  if (!ctx.enabled) {
    return { x: Math.round(rawX), y: Math.round(rawY), align: null };
  }

  const gridRound = (v: number) => Math.round(v / grid) * grid;

  const sx = snapAxis(
    rawX,
    ctx.dx,
    ctx.wall,
    ctx.L - ctx.wall,
    gridRound(rawX),
    ctx.others,
    "x",
    threshold
  );
  const sy = snapAxis(
    rawY,
    ctx.dy,
    ctx.wall,
    ctx.W - ctx.wall,
    gridRound(rawY),
    ctx.others,
    "y",
    threshold
  );

  return {
    x: Math.round(sx.value),
    y: Math.round(sy.value),
    align: sx.align ?? sy.align,
  };
}