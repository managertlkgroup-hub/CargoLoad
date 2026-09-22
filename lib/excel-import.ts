import Papa from "papaparse";
import * as XLSX from "xlsx";

import { createImportRowSchema, type T, type ImportRow } from "@/lib/validation";

/**
 * Импорт грузов из Excel (.xlsx/.xls) и CSV.
 *
 * Формат: первая строка — заголовки (RU или EN), каждая следующая — груз.
 * Поддерживаемые колонки: Название, Тип/форма, Длина, Ширина, Высота,
 * Диаметр, Вес, Количество, Штабелируемый, Группа, Цвет.
 * Размеры — в мм, вес — кг на единицу. Отсутствующие необязательные поля
 * заполняются значениями по умолчанию. Результат: валидные строки + отчёт
 * об ошибках (номер строки + сообщение).
 */

export interface ImportErrorRow {
  /** 1-based номер строки в исходном файле (после строки заголовков) */
  row: number;
  message: string;
}

export interface ImportParseResult {
  rows: ImportRow[];
  errors: ImportErrorRow[];
  /** сколько всего непустых строк данных встретилось */
  total: number;
  ok: boolean;
  error?: string;
}

const FIELD_ALIASES: Record<keyof ImportRow, string[]> = {
  name: ["name", "название", "наименование", "груз", "товар"],
  shape: ["shape", "форма", "тип"],
  length: ["length", "длина", "len"],
  width: ["width", "ширина"],
  height: ["height", "высота"],
  diameter: ["diameter", "диаметр", "диам"],
  weight: ["weight", "вес", "масса", "kg"],
  quantity: ["quantity", "количество", "кол-во", "колво", "qty", "шт"],
  stackable: ["stackable", "штабелируемый", "стек", "штабелируется"],
  group: ["group", "группа", "группасовместимости", "совместимость"],
  color: ["color", "цвет"],
};

function normHeader(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function buildAliasMap(): Map<string, keyof ImportRow> {
  const map = new Map<string, keyof ImportRow>();
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const a of aliases) map.set(normHeader(a), field as keyof ImportRow);
  }
  return map;
}

const ALIAS_MAP = buildAliasMap();

function canonicalField(header: string): keyof ImportRow | null {
  return ALIAS_MAP.get(normHeader(header)) ?? null;
}

/** Парсинг числа: «1,5», «1200 мм», «1.2 m», «2 т» → число; пустое → undefined. */
function toNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return undefined;
  let s = v.trim().replace(/\u00a0/g, " ");
  if (!s) return undefined;
  s = s
    .replace(/\s+/g, "")
    .replace(/,(?=\d)/g, ".")
    .replace(/(мм|см|м|кг|т|шт|kg|mm|cm|t|m)$/i, "")
    .trim();
  if (!s) return undefined;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function toBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v !== "string") return undefined;
  const s = v.trim().toLowerCase();
  if (["true", "yes", "да", "1", "+", "y", "д"].includes(s)) return true;
  if (["false", "no", "нет", "0", "-", "n", "н"].includes(s)) return false;
  return undefined;
}

function parseShape(v: string | undefined): "box" | "cylinder" | "oversize" {
  const s = (v ?? "").toLowerCase().trim();
  if (["cylinder", "цилиндр", "бочка", "barrel", "cyl"].includes(s)) return "cylinder";
  if (["oversize", "негабарит", "негабаритный"].includes(s)) return "oversize";
  return "box";
}

const DEFAULT_DIAMETER = 1000;

/** Превращает сырую строку (record) в объект для zod-схемы. */
function mapRow(
  record: Record<string, string | number | boolean | null | undefined>,
  fieldFromHeader: (h: string) => keyof ImportRow | null
): Partial<ImportRow> & { [k: string]: unknown } {
  const out: Partial<ImportRow> & { [k: string]: unknown } = {};
  for (const [header, raw] of Object.entries(record)) {
    const field = fieldFromHeader(header);
    if (!field) continue;
    const value = raw === null || raw === undefined ? "" : raw;
    if (field === "shape") {
      out.shape = parseShape(typeof value === "string" ? value : undefined);
      continue;
    }
    if (field === "stackable") {
      const b = toBool(value);
      if (b !== undefined) out.stackable = b;
      continue;
    }
    if (field === "name" || field === "group" || field === "color") {
      const s = typeof value === "string" ? value.trim() : "";
      if (s) out[field] = s;
      continue;
    }
    // числовые поля
    const n = toNumber(value);
    if (n !== undefined) out[field] = n;
  }
  return out;
}

function finalizeRow(partial: Partial<ImportRow>): ImportRow {
  const shape = partial.shape ?? "box";
  const stackable =
    partial.stackable ??
    (() => {
      const s = partial.stackable;
      return s === undefined ? true : s;
    })();

  return {
    name: partial.name ?? "",
    shape,
    length: partial.length ?? 1200,
    width: partial.width ?? 800,
    height: partial.height ?? 600,
    diameter: partial.diameter ?? (shape === "cylinder" ? 0 : DEFAULT_DIAMETER),
    // вес обязателен: undefined догонит валидация
    weight: partial.weight as number,
    quantity: partial.quantity ?? 1,
    stackable,
    group: partial.group ?? "general",
    color: partial.color ?? "#8B5CF6",
  } as ImportRow;
}

/** Валидация строки; возвращает либо данные, либо сообщение об ошибке. */
function validateRow(
  partial: Partial<ImportRow>,
  s: T
): { ok: true; data: ImportRow } | { ok: false; error: string } {
  const candidate = finalizeRow(partial);
  const r = createImportRowSchema(s).safeParse(candidate);
  if (r.success) return { ok: true, data: candidate };
  const messages = new Set(r.error.issues.map((i) => {
    const field = i.path[0];
    return `${field ? String(field) + ": " : ""}${i.message}`;
  }));
  return {
    ok: false,
    error: [...messages].join("; "),
  };
}

const rec = (
  v: unknown
): Record<string, string | number | boolean | null | undefined> => {
  if (v && typeof v === "object") return v as Record<string, string | number | boolean | null | undefined>;
  return {};
};

/** Разбор массива записей (объектов) в отчёт. */
function parseRecords(
  records: unknown[],
  fieldFromHeader: (h: string) => keyof ImportRow | null,
  s: T
): ImportParseResult {
  const rows: ImportRow[] = [];
  const errors: ImportErrorRow[] = [];
  let total = 0;

  const headerKeys = records[0] ? Object.keys(rec(records[0])) : [];
  if (headerKeys.length > 0 && !headerKeys.some((h) => canonicalField(h) !== null)) {
    return {
      rows,
      errors,
      total: 0,
      ok: false,
      error: "header.notFound",
    };
  }

  for (let i = 0; i < records.length; i++) {
    const record = rec(records[i]);
    const values = Object.values(record).filter(
      (v) => v !== null && v !== undefined && String(v).trim() !== ""
    );
    if (values.length === 0) continue;
    total++;
    const partial = mapRow(record, fieldFromHeader);
    const rowNumber = i + 2; // 1 — строка заголовков
    const result = validateRow(partial, s);
    if (result.ok) rows.push(result.data);
    else errors.push({ row: rowNumber, message: result.error });
  }

  return {
    rows,
    errors,
    total,
    ok: true,
  };
}

/** Чтение CSV-текста. */
function parseCsv(text: string, s: T): ImportParseResult {
  const res = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h,
  });
  if (res.errors?.length && (!res.data || res.data.length === 0)) {
    return {
      rows: [],
      errors: [],
      total: 0,
      ok: false,
      error: "csv.parse",
    };
  }
  return parseRecords(res.data as unknown[], canonicalField, s);
}

/** Чтение книги Excel (первый лист). */
function parseWorkbook(buf: ArrayBuffer, s: T): ImportParseResult {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "array" });
  } catch {
    return { rows: [], errors: [], total: 0, ok: false, error: "xlsx.parse" };
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: [], total: 0, ok: false, error: "xlsx.empty" };
  }
  const sheet = wb.Sheets[sheetName];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });
  return parseRecords(records, canonicalField, s);
}

/** Главная точка входа: парсинг файла по расширению. */
export async function parseCargoFile(file: File, s: T): Promise<ImportParseResult> {
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith(".csv") || name.endsWith(".txt")) {
      const text = await file.text();
      return parseCsv(text, s);
    }
    const buf = await file.arrayBuffer();
    return parseWorkbook(buf, s);
  } catch {
    return { rows: [], errors: [], total: 0, ok: false, error: "parse.failed" };
  }
}