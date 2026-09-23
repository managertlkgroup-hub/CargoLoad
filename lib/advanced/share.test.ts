import { describe, expect, it } from "vitest";

import {
  decodeShare,
  encodeShare,
  isShareHash,
  parseHash,
  shareUrl,
} from "@/lib/advanced/share";
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
  it("round-trip сохраняет сессию без потерь", async () => {
    const s = sample();
    const encoded = await encodeShare(s);
    expect(encoded.startsWith("s=")).toBe(true);
    const decoded = await decodeShare(encoded);
    expect(decoded).toEqual(s);
  });

  it("значение URL-safe: только [A-Za-z0-9_-], без паддинга", async () => {
    const encoded = await encodeShare(sample());
    const payload = encoded.slice(2);
    expect(/^[A-Za-z0-9_-]+$/.test(payload)).toBe(true);
    expect(payload).not.toContain("=");
    expect(payload).not.toContain("+");
    expect(payload).not.toContain("/");
  });

  it("кириллица и спецсимволы переживают round-trip", async () => {
    const s = sample();
    s.items[0].name = "Ящики «напр. 12» 400×300";
    s.stops[1].name = "Склад №2 / Юг";
    expect(await decodeShare(await encodeShare(s))).toEqual(s);
  });

  it("мусор/повреждение возвращают null", async () => {
    expect(await decodeShare("s=%%%")).toBeNull();
    expect(await decodeShare("")).toBeNull();
    expect(await decodeShare("x=abc")).toBeNull();
    expect(await decodeShare("s=!!!not-base64!!!")).toBeNull();
    expect(await decodeShare("s=eyJpdGVtcyI6Im5vdC1hcnJheSJ9")).toBeNull();
    expect(await decodeShare("s=rO0")).toBeNull();
  });

  it("parseHash разбирает только валидные хэши", async () => {
    const encoded = await encodeShare(sample());
    expect(await parseHash("#" + encoded)).toEqual(sample());
    expect(await parseHash("")).toBeNull();
    expect(await parseHash("#other")).toBeNull();
  });

  it("shareUrl собирает целевую ссылку", async () => {
    (globalThis as Record<string, unknown>).location = {
      origin: "https://cargo.example",
      pathname: "/app",
    };
    const url = await shareUrl(sample());
    expect(url.startsWith("https://cargo.example/app#s=")).toBe(true);
    const s = url.split("#")[1];
    expect(await decodeShare(s)).toEqual(sample());
  });

  it("isShareHash отличает отсутствие ссылки от повреждённой", () => {
    expect(isShareHash("#s=eyJ...")).toBe(true);
    expect(isShareHash("")).toBe(false);
    expect(isShareHash("#other")).toBe(false);
    expect(isShareHash("#s=")).toBe(true);
  });

  it("gzip сжимает: большая сессия умещается в QR (лимит EC L ≈ 2953 байта)", async () => {
    const big = sample();
    big.items = Array.from({ length: 40 }, (_, i) => ({
      ...sample().items[0],
      id: `item.${i}`,
      name: `Груз ${i} — очень длинное название для проверки сжатия`,
    }));
    big.placements = big.items.map((it, i) => ({
      id: `p${i}`,
      itemId: it.id,
      unitIndex: 0,
      x: i * 10,
      y: 0,
      z: 0,
      yaw: 0,
      axis: "up",
      stopIndex: 0,
    }));
    const encoded = await encodeShare(big);
    // URL целиком (протокол + host + path + hash) не должен превышать 2953 байт
    expect(encoded.length).toBeLessThan(2700);
  });
});