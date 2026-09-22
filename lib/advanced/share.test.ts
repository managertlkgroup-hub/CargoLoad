import { describe, expect, it } from "vitest";

import { decodeShare, encodeShare, parseHash, shareUrl } from "@/lib/advanced/share";
import type { SessionData } from "@/types";

function sample(): SessionData {
  return {
    items: [
      {
        id: "item.1",
        name: "Коробки",
        shape: "box",
        length: 600,
        width: 400,
        height: 400,
        diameter: 0,
        weight: 10,
        quantity: 12,
        stackable: true,
        maxTopLoad: 500,
        group: "general",
        color: "#8B5CF6",
        cylinderAxis: "up",
        stopIndex: 1,
      },
      {
        id: "item.2",
        name: "Бочки 200л",
        shape: "cylinder",
        length: 600,
        width: 600,
        height: 900,
        diameter: 600,
        weight: 200,
        quantity: 2,
        stackable: false,
        maxTopLoad: 0,
        group: "general",
        color: "#EF4444",
        cylinderAxis: "up",
        stopIndex: 0,
      },
    ],
    vehicleId: "vehicle.euro",
    mode: "mixed",
    gaps: {
      along: { wall: 10, rowWidth: 5, rowLength: 5 },
      cross: { wall: 10, rowWidth: 5, rowLength: 5 },
      mixed: { wall: 10, rowWidth: 5, rowLength: 5 },
    },
    placements: [
      { id: "p1", itemId: "item.1", unitIndex: 0, x: 10, y: 10, z: 0, yaw: 0, axis: "up", stopIndex: 1 },
      { id: "p2", itemId: "item.2", unitIndex: 0, x: 620, y: 10, z: 0, yaw: 0, axis: "up", stopIndex: 0 },
    ],
    stops: [
      { id: "stop.1", name: "Основная доставка" },
      { id: "stop.2", name: "Склад №2" },
    ],
    loadingSide: "rear",
    stacking: true,
    lifo: true,
    maxLayers: 0,
  };
}

describe("share: encode → open → restore", () => {
  it("round-trip сохраняет сессию без потерь", () => {
    const s = sample();
    const encoded = encodeShare(s);
    expect(encoded.startsWith("s=")).toBe(true);
    const decoded = decodeShare(encoded);
    expect(decoded).toEqual(s);
  });

  it("значение URL-safe: только [A-Za-z0-9_-], без паддинга", () => {
    const encoded = encodeShare(sample());
    const payload = encoded.slice(2);
    expect(/^[A-Za-z0-9_-]+$/.test(payload)).toBe(true);
    expect(payload).not.toContain("=");
    expect(payload).not.toContain("+");
    expect(payload).not.toContain("/");
  });

  it("кириллица и спецсимволы переживают round-trip", () => {
    const s = sample();
    s.items[0].name = "Ящики «напр. 12» 400×300";
    s.stops[1].name = "Склад №2 / Юг";
    expect(decodeShare(encodeShare(s))).toEqual(s);
  });

  it("мусор/повреждение возвращают null", () => {
    expect(decodeShare("s=%%%")).toBeNull();
    expect(decodeShare("")).toBeNull();
    expect(decodeShare("x=abc")).toBeNull();
    expect(decodeShare("s=!!!not-base64!!!")).toBeNull();
    expect(decodeShare("s=eyJpdGVtcyI6Im5vdC1hcnJheSJ9")).toBeNull();
  });

  it("parseHash разбирает только валидные хэши", () => {
    const encoded = encodeShare(sample());
    expect(parseHash("#" + encoded)).toEqual(sample());
    expect(parseHash("")).toBeNull();
    expect(parseHash("#other")).toBeNull();
  });

  it("shareUrl собирает целевую ссылку", () => {
    (globalThis as Record<string, unknown>).location = {
      origin: "https://cargo.example",
      pathname: "/app",
    };
    const url = shareUrl(sample());
    expect(url.startsWith("https://cargo.example/app#s=")).toBe(true);
    const s = url.split("#")[1];
    expect(decodeShare(s)).toEqual(sample());
  });
});