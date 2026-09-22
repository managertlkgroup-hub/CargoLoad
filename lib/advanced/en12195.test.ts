import { describe, expect, it } from "vitest";

import { FRICTION, requiredLashingLC, strappingPlan } from "@/lib/advanced/en12195";

describe("en12195: строповка груза", () => {
  it("5000 кг, дерево (μ=0.4): LC ≈ 5000 → 2 стропа × 2.5 т", () => {
    const plan = strappingPlan({ massKg: 5000 });
    expect(plan.requiredLC).toBe(5000);
    expect(plan.strapLC).toBe(2500);
    expect(plan.strapCount).toBe(2);
    expect(plan.mu).toBe(FRICTION.wood);
  });

  it("5000 кг, металл (μ=0.3): LC ≈ 8300 → 2 стропа × 5 т", () => {
    const plan = strappingPlan({ massKg: 5000, mu: FRICTION.steel });
    expect(plan.requiredLC).toBeCloseTo(8333, 0);
    expect(plan.strapLC).toBe(5000);
    expect(plan.strapCount).toBe(2);
  });

  it("2000 кг, дерево: LC 2000 → 2 стропа × 1 т", () => {
    const plan = strappingPlan({ massKg: 2000 });
    expect(plan.requiredLC).toBe(2000);
    expect(plan.strapLC).toBe(1000);
    expect(plan.strapCount).toBe(2);
  });

  it("лёгкий груз: один строп минимального рейтинга", () => {
    const plan = strappingPlan({ massKg: 400 });
    expect(plan.requiredLC).toBe(400);
    expect(plan.strapLC).toBe(1000);
    expect(plan.strapCount).toBe(1);
  });

  it("requiredLashingLC: формула m·(c−μ)/μ с запасом", () => {
    expect(requiredLashingLC({ massKg: 1000 })).toBe(1000);
    expect(requiredLashingLC({ massKg: 1000, mu: 0.3 })).toBeCloseTo(1666.67, 2);
    expect(requiredLashingLC({ massKg: 1000, safetyFactor: 1.5 })).toBe(1500);
    expect(requiredLashingLC({ massKg: 1000, mu: 0.3, safetyFactor: 2 })).toBeCloseTo(3333.33, 2);
  });

  it("учёт поперечного ускорения (cy=0.5 не главен при rear-раскладке)", () => {
    expect(requiredLashingLC({ massKg: 1000, cy: 0.9 })).toBeCloseTo(1250, 2);
  });
});