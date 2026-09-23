import type { SessionData } from "@/types";

/**
 * Шаринг раскладки: сериализация сессии в компактный URL-safe хэш `#s=…`.
 * Тело хэша: на браузерах/Node с CompressionStream и DecompressionStream —
 * gzip(JSON), иначе — сырой JSON. Первый байт — маркер формата:
 *   1 = gzip, 0 = raw utf-8; без маркера (наследие) — сразу JSON.
 * Декодирование валидирует минимальную форму и возвращает null при повреждениях.
 *
 * Асинхронность: encode/decode используют потоковые CompressionStream —
 * публичный API encodeShare/decodeShare/parseHash/shareUrl асинхронные.
 */

const PREFIX = "s=";
const HDR_GZIP = 1;
const HDR_RAW = 0;

const hasGzip =
  typeof CompressionStream === "function" && typeof DecompressionStream === "function";

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

/** Uint8Array с гарантированным ArrayBuffer подложкой (для Blob/Response). */
function toBlob(bytes: Uint8Array): Blob {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return new Blob([copy]);
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = toBlob(bytes).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = toBlob(bytes).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function withHeader(header: number, bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length + 1);
  out[0] = header;
  out.set(bytes, 1);
  return out;
}

/** Минимальная валидация формы сессии (поля не проверяются глубоко). */
function isSessionData(data: SessionData | null | undefined): boolean {
  if (!data || typeof data !== "object") return false;
  if (!Array.isArray(data.items)) return false;
  if (typeof data.vehicleId !== "string") return false;
  if (typeof data.mode !== "string") return false;
  if (!data.gaps || typeof data.gaps !== "object") return false;
  if (!Array.isArray(data.placements)) return false;
  if (!Array.isArray(data.stops)) return false;
  return true;
}

export async function encodeShare(session: SessionData): Promise<string> {
  const raw = toBytes(JSON.stringify(session));
  if (hasGzip) {
    return PREFIX + base64UrlSafe(withHeader(HDR_GZIP, await gzip(raw)));
  }
  return PREFIX + base64UrlSafe(withHeader(HDR_RAW, raw));
}

export async function decodeShare(text: string): Promise<SessionData | null> {
  if (!text.startsWith(PREFIX)) return null;
  const bytes = base64ToBytes(text.slice(PREFIX.length));
  if (!bytes || bytes.length === 0) return null;

  let jsonBytes: Uint8Array;
  if (bytes[0] === HDR_GZIP) {
    try {
      jsonBytes = await gunzip(bytes.slice(1));
    } catch {
      return null;
    }
  } else if (bytes[0] === HDR_RAW) {
    jsonBytes = bytes.slice(1);
  } else {
    // наследие: без маркера, тело — сразу JSON (первый байт '{' = 0x7B)
    jsonBytes = bytes;
  }

  try {
    const data = JSON.parse(fromBytes(jsonBytes)) as SessionData;
    return isSessionData(data) ? data : null;
  } catch {
    return null;
  }
}

export async function parseHash(hash: string): Promise<SessionData | null> {
  const m = /^#s=(.+)$/.exec(hash);
  if (!m) return null;
  return decodeShare(PREFIX + m[1]);
}

/**
 * Есть ли в URL-хэше share-параметр `#s=…` — независимо от валидности данных.
 * Позволяет отличить «нет ссылки» от «ссылка есть, но повреждена».
 */
export function isShareHash(hash: string): boolean {
  return /^#s=/.test(hash);
}

export async function shareUrl(session: SessionData): Promise<string> {
  const base = `${globalThis.location.origin}${globalThis.location.pathname}`;
  return `${base}#${await encodeShare(session)}`;
}