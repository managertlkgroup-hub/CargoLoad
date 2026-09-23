import { EN12195 } from "@/lib/constants";

/**
 * Расчёт крепления груза по EN 12195-1 (стяжные ремни, tie-down).
 * Требуемое удерживающее усилие для сдвига вдоль оси с максимальным
 * ускорением: F = m·(c − μ)/μ, где c — коэффициент ускорения (0.8 вдоль,
 * 0.5 поперёк), μ — коэффициент трения (по умолчанию 0.4 — сухое дерево).
 * Подбор ремней: наименьшее паспортное усилие, при котором нужно ≤2 стропа.
 */

/** Фрикционные пары из таблицы EN 12195-1 (материал → μ). */
export const FRICTION: Record<string, number> = {
  wood: 0.4,
  steel: 0.3,
  rubber: 0.6,
  unknown: 0.3,
};

export interface StrappingInput {
  massKg: number;
  mu?: number;
  /** ускорение вдоль длинной оси (сдвиг вперёд) */
  cx?: number;
  /** ускорение поперёк */
  cy?: number;
  safetyFactor?: number;
}

export interface StrappingPlan {
  /** требуемое удерживающее усилие с учётом запаса, кгс ≈ даН */
  requiredLC: number;
  /** паспортное усилие выбранного стропа, даН */
  strapLC: number;
  /** необходимое число стропов */
  strapCount: number;
  mu: number;
  cx: number;
  cy: number;
}

export function requiredLashingLC(input: StrappingInput): number {
  const mu = input.mu ?? FRICTION.wood;
  const cx = input.cx ?? 0.8;
  const cy = input.cy ?? 0.5;
  const accel = Math.max(cx, cy);
  if (mu <= 0) return Infinity;
  const sf = input.safetyFactor ?? 1;
  return (input.massKg * (accel - mu)) / mu * sf;
}

export function strappingPlan(input: StrappingInput): StrappingPlan {
  // округляем до 0.001 даН, чтобы плавающая точка не добавляла лишний строп
  // на точных границах (15000.000000000002 не должно давать ceil=4 при LC 15000)
  const needed = Number(requiredLashingLC(input).toFixed(3));
  const ratings = [...EN12195.strapRatings].sort((a, b) => a - b);
  let strapLC = ratings[ratings.length - 1];
  for (const r of ratings) {
    if (r >= needed) {
      strapLC = r;
      break;
    }
  }
  let strapCount = Math.max(1, Math.ceil(needed / strapLC));
  if (needed > 0) {
    for (const r of ratings) {
      const count = Math.max(1, Math.ceil(needed / r));
      if (count <= 2) {
        strapLC = r;
        strapCount = count;
        break;
      }
    }
  }
  return {
    requiredLC: Math.round(needed),
    strapLC,
    strapCount,
    mu: input.mu ?? FRICTION.wood,
    cx: input.cx ?? 0.8,
    cy: input.cy ?? 0.5,
  };
}