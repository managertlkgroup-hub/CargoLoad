import type { LoadMetrics } from "@/types";

/**
 * Офлайн AI-эвристики (без API): анализ текущей раскладки → карточки советов.
 * Правила заданы явными порогами; текст выбирается ключами i18n.
 */

export interface Advice {
  id: string;
  level: "info" | "warn" | "success";
  /** i18n-ключ текста */
  textKey: string;
  /** i18n-ключ подсказки (необязательно) */
  hintKey?: string;
  vars?: Record<string, string | number>;
}

const VOL_HIGH = 85;
const VOL_LOW = 40;
const WEIGHT_LOW = 30;

export function computeAdvices(
  metrics: LoadMetrics,
  layout: {
    mode: "along" | "cross" | "mixed";
    stacking: boolean;
    anyGapPositive: boolean;
  }
): Advice[] {
  const out: Advice[] = [];
  const { unplaced } = metrics;
  const unplacedCount = unplaced.reduce((s, u) => s + u.quantity, 0);

  // — заполнение — вс 1: объём
  if (metrics.placedCount > 0 && metrics.volumePct >= VOL_HIGH) {
    out.push({ id: "vol-high", level: "success", textKey: "hint.volHigh" });
  } else if (metrics.placedCount > 0 && metrics.volumePct < VOL_LOW) {
    out.push({ id: "vol-low", level: "info", textKey: "hint.volLow" });
  }

  // — вес —
  if (metrics.weightPct > 100) {
    out.push({ id: "weight-over", level: "warn", textKey: "hint.overweight" });
  } else if (metrics.placedCount > 0 && metrics.weightPct < WEIGHT_LOW) {
    out.push({ id: "weight-low", level: "info", textKey: "hint.underloaded" });
  }

  // — неразмещённые: смешанный режим / зазоры / стекинг —
  if (unplacedCount > 0 && layout.mode !== "mixed") {
    out.push({ id: "mode-mixed", level: "warn", textKey: "hint.mixed" });
  }
  if (unplacedCount > 0 && layout.anyGapPositive) {
    out.push({ id: "gaps-tighten", level: "warn", textKey: "hint.gaps" });
  }
  if (unplacedCount > 0 && !layout.stacking) {
    out.push({
      id: "stacking-off",
      level: "info",
      textKey: "hint.stackingOff",
      vars: { n: unplacedCount },
    });
  }
  if (unplacedCount > 0 && layout.stacking && !metrics.canStack) {
    out.push({ id: "not-stackable", level: "info", textKey: "hint.notStackable" });
  }

  // — центр тяжести —
  const cog = metrics.cog;
  if (cog.level === "crit" || cog.level === "warn") {
    if (Math.abs(cog.longitudinalPct) >= Math.abs(cog.lateralPct)) {
      out.push({
        id: "cog-long",
        level: "warn",
        textKey: "hint.cogLong",
        vars: { pct: cog.longitudinalPct },
      });
    } else {
      out.push({
        id: "cog-lat",
        level: "warn",
        textKey: "hint.cogLat",
        vars: { pct: cog.lateralPct },
      });
    }
  } else if (metrics.placedCount > 0) {
    out.push({ id: "cog-ok", level: "success", textKey: "hint.cogOk" });
  }

  // — всё размещено —
  if (unplacedCount === 0 && metrics.placedCount > 0) {
    out.push({
      id: "all-placed",
      level: "success",
      textKey: "hint.allPlaced",
      vars: { n: metrics.placedCount },
    });
  }

  return out;
}