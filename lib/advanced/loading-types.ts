import type { LoadingSide } from "@/types";

/** Типы загрузки: сторона доступа к кузову и профиль раскладки. */

export interface LoadingProfile {
  side: LoadingSide;
  /** основная ось заполнения — «глубина» кузова от двери */
  depthAxis: "x" | "y";
  /** ось свободного доступа к грузу при выгрузке */
  accessAxis: "x" | "y";
  /** рыхлая загрузка (грузы достаются без переборки) */
  freeAccess: boolean;
}

export function loadingProfile(side: LoadingSide): LoadingProfile {
  switch (side) {
    case "rear":
      return { side, depthAxis: "x", accessAxis: "x", freeAccess: true };
    case "right":
    case "left":
      return { side, depthAxis: "y", accessAxis: "y", freeAccess: false };
    case "top":
      return { side, depthAxis: "x", accessAxis: "x", freeAccess: true };
  }
}

export function isSideLoading(side: LoadingSide): boolean {
  return side === "right" || side === "left";
}

/** Нормализованная координата двери/доступа вдоль оси глубины (0..1). */
export function accessDepth(side: LoadingSide): number {
  return side === "rear" || side === "top" ? 1 : 0.5;
}