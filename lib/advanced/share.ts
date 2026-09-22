import type { SessionData } from "@/types";

/**
 * Шаринг раскладки: сериализация сессии в компактный URL-safe хэш `#s=…`.
 * Кодирование — base64url от JSON (без паддинга, без '+/'). Декодирование
 * валидирует минимальную форму и возвращает null при любых повреждениях.
 */

const PREFIX = "s=";

function toBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function fromBytes(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function base64UrlSafe(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64ToBytes(safe: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(safe)) return null;
  let b64 = safe.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  let bin: string;
  try {
    bin = atob(b64);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function encodeShare(session: SessionData): string {
  return PREFIX + base64UrlSafe(toBytes(JSON.stringify(session)));
}

export function decodeShare(text: string): SessionData | null {
  if (!text.startsWith(PREFIX)) return null;
  const bytes = base64ToBytes(text.slice(PREFIX.length));
  if (!bytes) return null;
  try {
    const data = JSON.parse(fromBytes(bytes)) as SessionData;
    if (!Array.isArray(data.items)) return null;
    if (typeof data.vehicleId !== "string") return null;
    if (typeof data.mode !== "string") return null;
    if (!data.gaps || typeof data.gaps !== "object") return null;
    if (!Array.isArray(data.placements)) return null;
    if (!Array.isArray(data.stops)) return null;
    return data;
  } catch {
    return null;
  }
}

export function parseHash(hash: string): SessionData | null {
  const m = /^#s=(.+)$/.exec(hash);
  if (!m) return null;
  return decodeShare("s=" + m[1]);
}

export function shareUrl(session: SessionData): string {
  const base = `${globalThis.location.origin}${globalThis.location.pathname}`;
  return `${base}#${encodeShare(session)}`;
}