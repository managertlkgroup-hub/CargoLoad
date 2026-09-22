import { describe, expect, it } from "vitest";

import { en } from "@/lib/i18n/en";
import { ru } from "@/lib/i18n/ru";

const PLACEHOLDER = /\{(\w+)\}/g;

/** Набор плейсхолдеров {x} в строке перевода. */
function varsOf(s: string): Set<string> {
  const out = new Set<string>();
  for (const m of s.matchAll(PLACEHOLDER)) out.add(m[1]);
  return out;
}

describe("i18n parity", () => {
  it("наборы ключей ru и en совпадают (нет сирот)", () => {
    const ruKeys = Object.keys(ru).sort();
    const enKeys = Object.keys(en).sort();
    expect(ruKeys).toEqual(enKeys);
  });

  it("плейсхолдеры {n}/{pct}/... совпадают для каждого общего ключа", () => {
    const missing: string[] = [];
    for (const key of Object.keys(ru)) {
      const rv = ru[key];
      const ev = en[key];
      const a = [...varsOf(rv)].sort().join(",");
      const b = [...varsOf(ev)].sort().join(",");
      if (a !== b) missing.push(`${key}: ru={${a}} en={${b}}`);
    }
    expect(missing).toEqual([]);
  });

  it("ни один перевод не остался на исходном ключе", () => {
    const raw: string[] = [];
    for (const key of Object.keys(ru)) {
      if (en[key] === key) raw.push(key);
    }
    expect(raw).toEqual([]);
  });

  it("критичные ключи переведены на оба языка", () => {
    for (const key of [
      "export.pdf",
      "export.layer",
      "theme.toLight",
      "dialog.close",
      "validation.nameRequired",
      "dims.l",
    ]) {
      expect(ru[key]).toBeTruthy();
      expect(en[key]).toBeTruthy();
      expect(ru[key]).not.toBe(en[key]);
    }
  });
});