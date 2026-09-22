import { describe, expect, it } from "vitest";

import {
  formatLength,
  formatNumber,
  formatVolume,
  formatWeight,
  lengthFromDisplay,
  lengthToDisplay,
  roundTo,
  weightFromDisplay,
  weightToDisplay,
} from "@/lib/units";

describe("units.roundTo", () => {
  it("округляет на границе без мусорных хвостов", () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(2.999, 2)).toBe(3);
    expect(roundTo(3282.6956576032567, 1)).toBe(3282.7);
  });

  it("возвращает 0 для не-чисел", () => {
    expect(roundTo(Number.NaN, 2)).toBe(0);
    expect(roundTo(Number.POSITIVE_INFINITY, 2)).toBe(0);
  });
});

describe("units.length round-trip", () => {
  it("мм → см → мм сохраняет точность", () => {
    const cm = lengthToDisplay(1505, "cm");
    expect(cm).toBe(150.5);
    expect(lengthFromDisplay(cm, "cm")).toBe(1505);
  });

  it("мм → м → мм сохраняет точность", () => {
    const m = lengthToDisplay(1505, "m");
    expect(m).toBe(1.505);
    expect(lengthFromDisplay(m, "m")).toBe(1505);
  });

  it("мм → мм не меняет значение", () => {
    expect(lengthToDisplay(12345, "mm")).toBe(12345);
    expect(lengthFromDisplay(12345, "mm")).toBe(12345);
  });
});

describe("units.weight round-trip", () => {
  it("кг → т → кг сохраняет точность", () => {
    const t = weightToDisplay(5320, "t");
    expect(t).toBe(5.32);
    expect(weightFromDisplay(t, "t")).toBe(5320);
  });

  it("кг → кг не меняет значение", () => {
    expect(weightToDisplay(1250, "kg")).toBe(1250);
    expect(weightFromDisplay(1250, "kg")).toBe(1250);
  });
});

describe("units.formatting", () => {
  it("форматирует длину по единице и локали", () => {
    expect(formatLength(1500, "mm", "ru")).toBe("1\u00A0500 мм");
    expect(formatLength(1500, "cm", "ru")).toBe("150 см");
    expect(formatLength(1500, "m", "ru")).toBe("1,5 м");
    expect(formatLength(1500, "m", "en")).toBe("1.5 m");
    expect(formatLength(5, "cm", "ru")).toBe("0,5 см");
  });

  it("форматирует вес по единице и локали", () => {
    expect(formatWeight(1250, "kg", "ru")).toBe("1\u00A0250 кг");
    expect(formatWeight(1250, "t", "ru")).toBe("1,25 т");
    expect(formatWeight(1250, "t", "en")).toBe("1.25 t");
    expect(formatWeight(980, "kg", "en")).toBe("980 kg");
  });

  it("форматирует объём с двумя знаками", () => {
    expect(formatVolume(1.23456, "ru")).toBe("1,23");
    expect(formatVolume(1.23456, "en")).toBe("1.23");
    expect(formatVolume(0.5, "ru")).toBe("0,5");
  });

  it("числа с разделителями по локали", () => {
    expect(formatNumber(1234.5, 1, "ru")).toContain(",");
    expect(formatNumber(1234.5, 1, "en")).toContain(".");
  });

  it("прецизионность по единицам (cm и m)", () => {
    expect(lengthToDisplay(1001, "cm")).toBe(100.1);
    expect(lengthToDisplay(1, "m")).toBe(0.001);
    expect(weightToDisplay(1, "t")).toBe(0.001);
  });
});