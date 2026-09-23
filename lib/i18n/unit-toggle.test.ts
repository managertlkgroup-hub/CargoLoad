import { describe, expect, it } from "vitest";

import { GRID_SIZES } from "@/lib/constants";
import {
  formatLength,
  formatWeight,
  lengthFromDisplay,
  lengthToDisplay,
  weightFromDisplay,
  weightToDisplay,
} from "@/lib/units";
import { useUiStore } from "@/store/use-ui-store";

describe("unit-toggle: длина мм → см → м", () => {
  it("пересчёт значений по делителям", () => {
    expect(lengthToDisplay(1500, "mm")).toBe(1500);
    expect(lengthToDisplay(1500, "cm")).toBe(150);
    expect(lengthToDisplay(1500, "m")).toBe(1.5);
  });

  it("точность по спеке: мм — целые, см — 1 знак, м — 2 знака", () => {
    expect(formatLength(1234, "mm", "ru")).toBe("1\u00A0234 мм");
    expect(formatLength(1234, "cm", "ru")).toBe("123,4 см");
    expect(formatLength(1234, "m", "ru")).toBe("1,23 м");
    expect(formatLength(1234, "m", "en")).toBe("1.23 m");
  });

  it("round-trip не теряет круглые значения", () => {
    expect(lengthFromDisplay(lengthToDisplay(1500, "cm"), "cm")).toBe(1500);
    expect(lengthFromDisplay(lengthToDisplay(1500, "m"), "m")).toBe(1500);
    expect(lengthFromDisplay(lengthToDisplay(12345, "mm"), "mm")).toBe(12345);
  });
});

describe("unit-toggle: вес кг → т", () => {
  it("пересчёт значений по делителям", () => {
    expect(weightToDisplay(5320, "kg")).toBe(5320);
    expect(weightToDisplay(5320, "t")).toBe(5.32);
  });

  it("точность по спеке: кг — целые, т — 2 знака", () => {
    expect(formatWeight(5320, "kg", "ru")).toBe("5\u00A0320 кг");
    expect(formatWeight(5320, "t", "ru")).toBe("5,32 т");
    expect(formatWeight(500, "kg", "ru")).toBe("500 кг");
  });

  it("round-trip кг → т → кг", () => {
    expect(weightFromDisplay(weightToDisplay(5320, "t"), "t")).toBe(5320);
    expect(weightFromDisplay(weightToDisplay(1250, "kg"), "kg")).toBe(1250);
  });
});

describe("unit-toggle: переключение в сторе", () => {
  it("setUnits меняет только единицы, остальное состояние цело", () => {
    useUiStore.setState({
      lengthUnit: "mm",
      weightUnit: "kg",
      locale: "ru",
      gridSize: GRID_SIZES[1],
      showLegend: false,
    });

    useUiStore.getState().setUnits({ lengthUnit: "m", weightUnit: "t" });
    const state = useUiStore.getState();
    expect(state.lengthUnit).toBe("m");
    expect(state.weightUnit).toBe("t");
    expect(state.locale).toBe("ru");
    expect(state.gridSize).toBe(GRID_SIZES[1]);
    expect(state.showLegend).toBe(false);
  });
});