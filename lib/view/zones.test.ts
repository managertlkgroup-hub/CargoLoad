import { describe, expect, it } from "vitest";

import { computeViewZones, rectsIntersect } from "@/lib/view/zones";

describe("2D view zones", () => {
  it("легенда не пересекается с подписями размеров кузова (баг прошлой версии)", () => {
    for (const [w, h] of [
      [400, 300],
      [800, 600],
      [1280, 720],
      [1920, 480],
      [480, 1080],
    ] as const) {
      const z = computeViewZones(w, h, 8);
      expect(rectsIntersect(z.legend, z.dimsTop), `legend∩dimsTop ${w}×${h}`).toBe(false);
      expect(rectsIntersect(z.legend, z.dimsLeft), `legend∩dimsLeft ${w}×${h}`).toBe(false);
      // зоны внутри вьюпорта
      expect(z.legend.x + z.legend.w).toBeLessThanOrEqual(w);
      expect(z.legend.y + z.legend.h).toBeLessThanOrEqual(h);
      expect(z.dimsTop.x).toBeGreaterThanOrEqual(0);
      expect(z.dimsLeft.y).toBeGreaterThanOrEqual(0);
    }
  });

  it("размер легенды растёт от числа строк (ограничен6)", () => {
    const few = computeViewZones(800, 600, 1);
    const many = computeViewZones(800, 600, 20);
    expect(many.legend.h).toBeGreaterThan(few.legend.h);
    expect(many.legend.h).toBeLessThanOrEqual(26 + 6 * 20 + 10);
  });
});
