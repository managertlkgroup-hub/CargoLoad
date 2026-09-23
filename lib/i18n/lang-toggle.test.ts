import { describe, expect, it } from "vitest";

import { en } from "@/lib/i18n/en";
import { ru } from "@/lib/i18n/ru";
import { translate } from "@/lib/i18n";
import { useUiStore } from "@/store/use-ui-store";

const TOGGLE_KEYS = ["app.lang.label", "units.length.label", "units.weight.label"] as const;

describe("lang-toggle: RU ↔ EN", () => {
  it("паритет словарей: каждый ключ ru есть в en с непустым значением", () => {
    for (const key of Object.keys(ru)) {
      expect(typeof en[key]).toBe("string");
      expect(en[key].length).toBeGreaterThan(0);
    }
  });

  it("ни один перевод не совпал с самим ключом", () => {
    const raw = Object.keys(ru).filter((key) => en[key] === key);
    expect(raw).toEqual([]);
  });

  it("ключи переключателей добавлены в оба словаря и различаются по локали", () => {
    for (const key of TOGGLE_KEYS) {
      expect(typeof ru[key]).toBe("string");
      expect(typeof en[key]).toBe("string");
      expect(ru[key]).not.toBe(en[key]);
    }
  });

  it("translate переключает язык для одного и того же ключа", () => {
    expect(translate("ru", "app.tagline")).toBe(ru["app.tagline"]);
    expect(translate("en", "app.tagline")).toBe(en["app.tagline"]);
    expect(translate("ru", "app.lang.label")).toBe(ru["app.lang.label"]);
    expect(translate("en", "app.lang.label")).toBe(en["app.lang.label"]);
  });

  it("фолбэк: неизвестный ключ возвращается как есть", () => {
    expect(translate("en", "no.such.key")).toBe("no.such.key");
  });

  it("setLocale переключает язык в сторе и не трогает остальное состояние", () => {
    useUiStore.setState({
      locale: "ru",
      lengthUnit: "mm",
      weightUnit: "kg",
      rightPanelOpen: true,
      showDimensions: true,
    });

    useUiStore.getState().setLocale("en");
    const enState = useUiStore.getState();
    expect(enState.locale).toBe("en");
    expect(enState.lengthUnit).toBe("mm");
    expect(enState.weightUnit).toBe("kg");
    expect(enState.rightPanelOpen).toBe(true);
    expect(enState.showDimensions).toBe(true);

    useUiStore.getState().setLocale("ru");
    expect(useUiStore.getState().locale).toBe("ru");
  });
});