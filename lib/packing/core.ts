import { COLLISION_EPS } from "@/lib/constants";
import { dimsFor, type Geom } from "@/lib/geometry";
import type {
  CargoItem,
  CylinderAxis,
  LayerInfo,
  PackRequest,
  PackResult,
  Placement,
  Unplaced,
  UnplacedReason,
  Yaw,
} from "@/types";

/**
 * Ядро упаковки: extreme-point алгоритм с shelf-зазорами,
 * проверкой опоры/нагрузок/совместимости при штабелировании,
 * LIFO-приоритетом мульти-стопа и гнездованием горизонтальных цилиндров.
 *
 * Инварианты:
 *  - пересечение грузов запрещено, касание разрешено (допуск eps);
 *  - зазоры от стен (wall) — по 4 боковым стенам, вертикально пол/потолок чётко;
 *  - зазоры между рядами (rowLength по X, rowWidth по Y) — per-mode;
 *  - груз в пределах [wall, L−wall] × [wall, W−wall] по XY и [0, H] по Z;
 *  - стек: только в группе совместимости, через плоскую опору, с учётом
 *    макс. нагрузки сверху по всей цепочке опор;
 *  - сторона загрузки (loadingSide) на раскладку НЕ влияет (только метки).
 *
 * Производительность: пространственная хеш-сетка для коллизий,
 * доминирование точек (Pareto-фронтир), каппа единиц MAX_UNITS.
 */

const MAX_UNITS = 6000;
const EPS = COLLISION_EPS;
const SUPPORT_EPS = 1.5;
/** допуск к высоте кузова для гнездования (меньше физического кузова) */
const NEST_TOL = 100;
const SQRT3_2 = 0.8660254037844386;

type Orient = { yaw: Yaw; axis: CylinderAxis };

interface Unit {
  item: CargoItem;
  unitIndex: number;
  stopIndex: number;
}

interface Box {
  /** реальные координаты/габариты, мм (в «пространственных» координатах) */
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  /** эффективный footprint с зазорами рядов (для коллизий) */
  ex: number;
  ey: number;
  itemId: string;
  unitIndex: number;
  flatTop: boolean;
  layer: number;
  loadAbove: number;
  /** доли опоры: [индекс родителя, доля] (сумма = 1) */
  supportShares: Array<[number, number]>;
  supporters: number[];
}

interface Pt {
  x: number;
  y: number;
  z: number;
}

/* ----------------------------- пространственная сетка ----------------------------- */

class Grid {
  private cell = 512;
  private map = new Map<number, number[]>();
  private stamp: number[] = [];
  private gen = 0;

  private key(cx: number, cy: number): number {
    return (cy + 8192) * 32768 + (cx + 8192);
  }

  insert(i: number, b: Box): void {
    const x0 = Math.floor(b.x / this.cell);
    const x1 = Math.floor((b.x + b.ex) / this.cell);
    const y0 = Math.floor(b.y / this.cell);
    const y1 = Math.floor((b.y + b.ey) / this.cell);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const k = this.key(cx, cy);
        let arr = this.map.get(k);
        if (!arr) {
          arr = [];
          this.map.set(k, arr);
        }
        arr.push(i);
      }
    }
  }

  /** Кандидаты по XY-ячейкам (дедупликация через stamp). */
  query(
    x: number,
    y: number,
    ex: number,
    ey: number,
    out: number[]
  ): number[] {
    this.gen++;
    const g = this.gen;
    const x0 = Math.floor(x / this.cell);
    const x1 = Math.floor((x + ex) / this.cell);
    const y0 = Math.floor(y / this.cell);
    const y1 = Math.floor((y + ey) / this.cell);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const arr = this.map.get(this.key(cx, cy));
        if (!arr) continue;
        for (const i of arr) {
          if (this.stamp[i] !== g) {
            this.stamp[i] = g;
            out.push(i);
          }
        }
      }
    }
    return out;
  }
}

/* ----------------------------- вспомогательные ----------------------------- */

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function clampGap(v: number): number {
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(Math.round(v), 5000);
}

/** Эффективный (с зазорами) прямоугольник кандидата. */
function effOverlap(
  ax: number,
  ay: number,
  az: number,
  aex: number,
  aey: number,
  adz: number,
  b: Box
): boolean {
  return (
    ax < b.x + b.ex - EPS &&
    ax + aex > b.x + EPS &&
    ay < b.y + b.ey - EPS &&
    ay + aey > b.y + EPS &&
    az < b.z + b.dz - EPS &&
    az + adz > b.z + EPS
  );
}

/** Пересечение реальных боксов с допуском (касание разрешено) — для keep. */
function realOverlap(
  ax: number,
  ay: number,
  az: number,
  adx: number,
  ady: number,
  adz: number,
  b: { x: number; y: number; z: number; dx: number; dy: number; dz: number }
): boolean {
  return (
    ax < b.x + b.dx - EPS &&
    ax + adx > b.x + EPS &&
    ay < b.y + b.dy - EPS &&
    ay + ady > b.y + EPS &&
    az < b.z + b.dz - EPS &&
    az + adz > b.z + EPS
  );
}

/**
 * Добавление точки с доминированием (Pareto): худшие отбрасываются.
 * Отброшенные можно собрать в rejected — они пригодятся как запасной
 * набор, когда «лучшая» точка закрыта сохранённым грузом (keep).
 */
function addPoint(pts: Pt[], p: Pt, rejected?: Pt[]): void {
  const e = EPS;
  for (const q of pts) {
    if (q.x <= p.x + e && q.y <= p.y + e && q.z <= p.z + e) {
      rejected?.push(p);
      return;
    }
  }
  let i = 0;
  while (i < pts.length) {
    const q = pts[i];
    const dominated =
      p.x <= q.x + e && p.y <= q.y + e && p.z <= q.z + e && !(q.x <= p.x + e && q.y <= p.y + e && q.z <= p.z + e);
    if (dominated) {
      pts.splice(i, 1);
    } else {
      i++;
    }
  }
  pts.push(p);
}

/* ----------------------------- гнездование цилиндров ----------------------------- */

interface NestPlan {
  n: number;
  s: number;
  k: number;
  /** высота кургана при k слоёв (мм) */
  height: number;
  /** footprint кургана (мм) */
  dx: number;
  dy: number;
  capacity: number;
  /** относительные координаты слотов (от нижнего левого угла кургана), по слоям снизу вверх */
  slots: Array<{ ux: number; uy: number; z: number }>;
}

/**
 * План шестиугольного гнездования горизонтальных цилиндров.
 * d — диаметр, l — длина обечайки.
 * Ряды чередуются n (чёрный) и n−1 (смещённый на d/2) элементов —
 * вложенных в пазы. s штабелей стоят вдоль оси длины.
 */
function nestPlan(
  geom: Geom,
  qty: number,
  L: number,
  W: number,
  H: number,
  wall: number,
  yaw: Yaw
): NestPlan | null {
  const d = geom.diameter;
  const l = geom.length;
  if (d <= 0 || l <= 0 || qty <= 0) return null;

  // поперек рядов (row): ширина кузова минус стены; вдоль штабелей (stack): длина
  const rowMax = yaw === 0 ? W - 2 * wall : L - 2 * wall;
  const stackMax = yaw === 0 ? L - 2 * wall : W - 2 * wall;
  if (rowMax < d + EPS || stackMax < l + EPS) return null;

  const n = Math.max(1, Math.floor(rowMax / d));
  const smax = Math.max(1, Math.floor(stackMax / l));
  const capacityFor = (k: number): number => {
    if (n === 1) return k;
    if (k % 2 === 0) return (k / 2) * (2 * n - 1);
    return ((k + 1) / 2) * n + ((k - 1) / 2) * (n - 1);
  };
  const heightFor = (k: number): number => d + (k - 1) * d * SQRT3_2;

  for (let s = 1; s <= smax; s++) {
    const need = Math.ceil(qty / s);
    for (let k = 1; k <= 50; k++) {
      if (heightFor(k) > H + NEST_TOL) break;
      if (capacityFor(k) < need) continue;
      // слоты: уровень ℓ (0..k−1), позиция j в ряду, штабель σ (0..s−1)
      const slots: Array<{ ux: number; uy: number; z: number }> = [];
      for (let sigma = 0; sigma < s; sigma++) {
        for (let lev = 0; lev < k; lev++) {
          const cnt = lev % 2 === 0 ? n : n - 1;
          const cy = lev % 2 === 1 ? d / 2 : 0;
          for (let j = 0; j < cnt; j++) {
            if (yaw === 90) {
              slots.push({
                ux: cy + j * d,
                uy: sigma * l,
                z: lev * d * SQRT3_2,
              });
            } else {
              slots.push({
                ux: sigma * l,
                uy: cy + j * d,
                z: lev * d * SQRT3_2,
              });
            }
          }
        }
      }
      if (slots.length < qty) continue;
      return {
        n,
        s,
        k,
        height: heightFor(k),
        dx: yaw === 90 ? n * d : s * l,
        dy: yaw === 90 ? s * l : n * d,
        capacity: s * capacityFor(k),
        slots,
      };
    }
  }
  return null;
}

/** Типовая ориентация единицы в заданном режиме (с учётом внешней принудительной). */
function modeOrientations(
  item: CargoItem,
  mode: PackRequest["mode"],
  L: number,
  W: number,
  wall: number,
  forced?: Map<string, Orient>
): Array<Orient> {
  const f = forced?.get(item.id);
  if (f) return [f];

  if (item.shape === "cylinder") {
    if (item.cylinderAxis === "side") {
      return [{ yaw: mode === "cross" ? 90 : 0, axis: "side" }];
    }
    // цилиндр пользователь задал стоящим: сначала up, при невместимости — лёжа
    return mode === "cross"
      ? [
          { yaw: 0, axis: "up" },
          { yaw: 90, axis: "side" },
        ]
      : [
          { yaw: 0, axis: "up" },
          { yaw: 0, axis: "side" },
        ];
  }

  if (mode === "cross") {
    const rot = dimsFor(item, 90, "up");
    const fitsRot =
      rot.dx <= L - 2 * wall + EPS && rot.dy <= W - 2 * wall + EPS;
    return [{ yaw: fitsRot ? 90 : 0, axis: "up" }];
  }
  return [{ yaw: 0, axis: "up" }];
}

/* ----------------------------- поиск для «смешанного» ----------------------------- */

function fitsBody(
  item: CargoItem,
  o: Orient,
  L: number,
  W: number,
  H: number,
  wall: number
): boolean {
  const d = dimsFor(item, o.yaw, o.axis);
  return (
    d.dx <= L - 2 * wall + EPS &&
    d.dy <= W - 2 * wall + EPS &&
    d.dz <= H + EPS
  );
}

/**
 * «Смешанный» режим: независимый выбор ориентации по типу груза,
 * минимизирующий объём итоговой укладки. Перебор комбинаций с каппой,
 * при превышении — жадный спуск с одиночными инверсиями.
 */
function mixedSearch(req: PackRequest): Map<string, Orient> | undefined {
  const L = req.vehicle.innerLength;
  const W = req.vehicle.innerWidth;
  const H = req.vehicle.innerHeight;
  const wall = clampGap(req.gaps.wall);
  const domains = new Map<string, Orient[]>();
  for (const item of req.items) {
    const base: Orient[] =
      item.shape === "cylinder"
        ? item.cylinderAxis === "side"
          ? [
              { yaw: 0, axis: "side" },
              { yaw: 90, axis: "side" },
            ]
          : [
              { yaw: 0, axis: "up" },
              { yaw: 0, axis: "side" },
              { yaw: 90, axis: "side" },
            ]
        : [
            { yaw: 0, axis: "up" },
            { yaw: 90, axis: "up" },
          ];
    const dom = base.filter((o) => fitsBody(item, o, L, W, H, wall));
    domains.set(item.id, dom.length ? dom : [base[0]]);
  }

    const ids = req.items.map((i) => i.id);
    const combos: Array<Map<string, Orient>> = [];
    const build = (idx: number, cur: Map<string, Orient>) => {
      if (idx === ids.length) {
        combos.push(new Map(cur));
        return;
      }
      for (const o of domains.get(ids[idx])!) {
        cur.set(ids[idx], o);
        build(idx + 1, cur);
      }
      cur.delete(ids[idx]);
    };
    build(0, new Map());
    if (!combos.length) return undefined;

    const scoreOf = (assign: Map<string, Orient>): number => {
      const r = packLayoutImpl(req, assign);
      let xu = 0;
      let yu = 0;
      let zu = 0;
      for (const p of r.placements) {
        const item = req.items.find((i) => i.id === p.itemId);
        if (!item) continue;
        const d = dimsFor(item, p.yaw, p.axis);
        xu = Math.max(xu, p.x + d.dx);
        yu = Math.max(yu, p.y + d.dy);
        zu = Math.max(zu, p.z + d.dz);
      }
      const total = req.items.reduce((s, i) => s + i.quantity, 0);
      return (total - r.placements.length) * 1e18 + xu * yu * zu;
    };

    let best: Map<string, Orient> = combos[0];
    let bestScore = scoreOf(best);

    if (combos.length <= 2600) {
      for (const assign of combos) {
        const sc = scoreOf(assign);
        if (sc < bestScore) {
          bestScore = sc;
          best = assign;
        }
      }
      return best;
    }

    // жадный спуск
    let improved = true;
    while (improved) {
      improved = false;
      for (const id of ids) {
        const cur = best.get(id)!;
        for (const alt of domains.get(id)!) {
          if (alt.yaw === cur.yaw && alt.axis === cur.axis) continue;
          const candidate = new Map(best);
          candidate.set(id, alt);
          const sc = scoreOf(candidate);
          if (sc < bestScore) {
            bestScore = sc;
            best = candidate;
            improved = true;
          }
        }
      }
    }
    return best;
}

/* ----------------------------- основной алгоритм ----------------------------- */

function packLayoutImpl(req: PackRequest, forced?: Map<string, Orient>): PackResult {
  const t0 = now();
  const { items, vehicle, mode, gaps, stacking, maxLayers, lifo } = req;

  const L = vehicle.innerLength;
  const W = vehicle.innerWidth;
  const H = vehicle.innerHeight;
  const wall = clampGap(gaps.wall);
  const rowL = clampGap(gaps.rowLength);
  const rowW = clampGap(gaps.rowWidth);

  const unplacedAgg = new Map<string, { qty: number; reason: UnplacedReason }>();
  const addUnplaced = (itemId: string, qty: number, reason: UnplacedReason) => {
    if (qty <= 0) return;
    const key = `${itemId}|${reason}`;
    const cur = unplacedAgg.get(key);
    if (cur) cur.qty += qty;
    else unplacedAgg.set(key, { qty, reason });
  };

  /* — предварительные данные по каждому типу груза — */
  interface ItemInfo {
    geom: Geom;
    orients: Array<Orient & { dx: number; dy: number; dz: number }>;
    tooBig: boolean;
    volume: number;
    area: number;
  }
  const infoByItem = new Map<string, ItemInfo>();

  for (const item of items) {
    const orients = modeOrientations(item, mode, L, W, wall, forced).map((o) => {
      const d = dimsFor(item, o.yaw, o.axis);
      return { ...o, ...d };
    });
    const tooBig = orients.every(
      (o) =>
        o.dx > L - 2 * wall + EPS ||
        o.dy > W - 2 * wall + EPS ||
        o.dz > H + EPS
    );
    const base = orients[0];
    infoByItem.set(item.id, {
      geom: item,
      orients,
      tooBig,
      volume: base.dx * base.dy * base.dz,
      area: base.dx * base.dy,
    });
  }

  const anchorX = wall;
  const anchorY = wall;

  const placed: Box[] = [];
  const grid = new Grid();
  const pts: Pt[] = [{ x: anchorX, y: anchorY, z: 0 }];
  const itemById = new Map<string, CargoItem>(items.map((i) => [i.id, i]));
  let weightUsed = 0;

  const candidates: number[] = [];
  const scratch: number[] = [];

  /** Точка мертва, если на неё уже не влезает ни один груз (бокс/границы). */
  const deadPoint = (q: Pt): boolean => {
    if (q.x > L - wall - 100 || q.y > W - wall - 100 || q.z > H - 100) return true;
    scratch.length = 0;
    grid.query(q.x, q.y, 1, 1, scratch);
    for (const i of scratch) {
      const b = placed[i];
      if (
        q.x >= b.x - 0.5 &&
        q.x < b.x + b.ex - 0.5 &&
        q.y >= b.y - 0.5 &&
        q.y < b.y + b.ey - 0.5 &&
        q.z > b.z - 0.5 &&
        q.z < b.z + b.dz - 0.5
      ) {
        return true;
      }
    }
    return false;
  };

  /** Предложить точку: мёртвые не добавляются (и не могут «доминировать»). */
  const offerPoint = (x: number, y: number, z: number, rejected?: Pt[]) => {
    const q: Pt = { x, y, z };
    if (!deadPoint(q)) addPoint(pts, q, rejected);
  };

  /**
   * Линия фронта «полки»: максимум передней кромки среди грузов, замыкающих
   * диапазон бокса по той же высоте (касание рядов разрешено). Новые ряды
   * начинаются от полного фронта предыдущего, а не от кромки последнего
   * предмета — так наборы A/B/C совпадают с эталонным ручным расчётом.
   */
  const frontMax = (x: number, dx: number, y: number, dy: number, z: number): number => {
    let fx = x + dx;
    candidates.length = 0;
    grid.query(x, y, dx, dy, candidates);
    for (const i of candidates) {
      const b = placed[i];
      if (Math.abs(b.z - z) > 0.5) continue;
      if (
        b.y < y + dy - 0.5 &&
        b.y + b.dy > y - 0.5 &&
        b.x < x + dx - 0.5 &&
        b.x + b.dx > x + 0.5
      ) {
        if (b.x + b.dx > fx) fx = b.x + b.dx;
      }
    }
    return fx;
  };

  /* — сохранённые (ручные) размещения: keep — позиции, которые нельзя трогать — */
  const keepKeys = new Set<string>();
  const keptPlacements: Placement[] = [];
  const keptZs: number[] = [];
  const keepFallback: Pt[] = [];
  const keptItemIds = new Set<string>();
  if (req.keep?.length) {
    const sortedKeep = [...req.keep].sort(
      (a, b) =>
        a.z - b.z ||
        a.x - b.x ||
        a.y - b.y ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );
    for (const k of sortedKeep) {
      const item = itemById.get(k.itemId);
      if (!item) continue;
      if (k.unitIndex < 0 || k.unitIndex >= item.quantity) continue;
      const key = `${k.itemId}:${k.unitIndex}`;
      if (keepKeys.has(key)) continue;
      const d = dimsFor(item, k.yaw, k.axis);
      if (
        k.x < -EPS ||
        k.y < -EPS ||
        k.x + d.dx > L + EPS ||
        k.y + d.dy > W + EPS ||
        k.z < -EPS ||
        k.z + d.dz > H + EPS
      ) {
        continue;
      }
      let clash = false;
      for (const b of placed) {
        if (realOverlap(k.x, k.y, k.z, d.dx, d.dy, d.dz, b)) {
          clash = true;
          break;
        }
      }
      if (clash) continue;
      if (keptZs[keptZs.length - 1] !== k.z) keptZs.push(k.z);
      const box: Box = {
        x: k.x,
        y: k.y,
        z: k.z,
        dx: d.dx,
        dy: d.dy,
        dz: d.dz,
        ex: d.dx + rowL,
        ey: d.dy + rowW,
        itemId: k.itemId,
        unitIndex: k.unitIndex,
        flatTop: !(item.shape === "cylinder" && k.axis === "side"),
        layer: keptZs.indexOf(k.z),
        loadAbove: 0,
        supportShares: [],
        supporters: [],
      };
      placed.push(box);
      grid.insert(placed.length - 1, box);
      keepKeys.add(key);
      keptItemIds.add(k.itemId);
      keptPlacements.push({
        ...k,
        x: Math.round(k.x),
        y: Math.round(k.y),
        z: Math.round(k.z),
        stopIndex: item.stopIndex,
      });
      weightUsed += item.weight;
    }
    if (keptPlacements.length) {
      for (let i = pts.length - 1; i >= 0; i--) {
        if (deadPoint(pts[i])) pts.splice(i, 1);
      }
      for (const b of placed) {
        offerPoint(b.x + b.dx + rowL, b.y, b.z, keepFallback);
        offerPoint(b.x, b.y + b.dy + rowW, b.z, keepFallback);
        offerPoint(b.x, b.y, b.z + b.dz, keepFallback);
        offerPoint(b.x + b.dx + rowL, anchorY, b.z, keepFallback);
        offerPoint(anchorX, b.y + b.dy + rowW, b.z, keepFallback);
      }
    }
  }

  /* — гнездование горизонтальных цилиндров: курган занимает блок слотом — */
  const placements: Placement[] = [...keptPlacements];
  const nestedItemIds = new Set<string>();
  {
    const candidatesNest: Array<{ item: CargoItem; plan: NestPlan; orient: Orient; volume: number }> = [];
    for (const item of items) {
      const info = infoByItem.get(item.id)!;
      if (info.tooBig) continue;
      if (keptItemIds.has(item.id)) continue;
      const eff = modeOrientations(item, mode, L, W, wall, forced);
      if (eff.length !== 1 || eff[0].axis !== "side") continue;
      const plan = nestPlan(item, item.quantity, L, W, H, wall, eff[0].yaw);
      if (!plan || plan.k < 2 || plan.capacity < item.quantity) continue;
      candidatesNest.push({ item, plan, orient: eff[0], volume: info.volume });
    }
    candidatesNest.sort((a, b) => b.volume - a.volume);
    for (const { item, plan, orient } of candidatesNest) {
      if (weightUsed + item.weight * item.quantity > vehicle.payload + EPS) continue;
      const floor = pts
        .filter((p) => p.z <= EPS)
        .sort((a, b) => a.x - b.x || a.y - b.y);
      let settled = false;
      for (const p of floor) {
        if (p.x + plan.dx > L - wall + EPS || p.y + plan.dy > W - wall + EPS) continue;
        if (plan.height > H + NEST_TOL - p.z) continue;
        const ex = plan.dx + rowL;
        const ey = plan.dy + rowW;
        candidates.length = 0;
        grid.query(p.x, p.y, ex, ey, candidates);
        let collided = false;
        for (const i of candidates) {
          const b = placed[i];
          if (effOverlap(p.x, p.y, p.z, ex, ey, plan.height, b)) {
            collided = true;
            break;
          }
        }
        if (collided) continue;

        for (let u = 0; u < item.quantity; u++) {
          const s = plan.slots[u];
          placements.push({
            id: `${item.id}:${u}`,
            itemId: item.id,
            unitIndex: u,
            x: Math.round(p.x + s.ux),
            y: Math.round(p.y + s.uy),
            z: Math.round(p.z + s.z),
            yaw: orient.yaw,
            axis: "side",
            stopIndex: item.stopIndex,
          });
        }
        const block: Box = {
          x: p.x,
          y: p.y,
          z: p.z,
          dx: plan.dx,
          dy: plan.dy,
          dz: plan.height,
          ex,
          ey,
          itemId: item.id,
          unitIndex: -1,
          flatTop: false,
          layer: 0,
          loadAbove: 0,
          supportShares: [],
          supporters: [],
        };
        placed.push(block);
        grid.insert(placed.length - 1, block);
        weightUsed += item.weight * item.quantity;
        nestedItemIds.add(item.id);

        const usedIdx = pts.indexOf(p);
        if (usedIdx >= 0) pts.splice(usedIdx, 1);
        for (let k = pts.length - 1; k >= 0; k--) {
          const q = pts[k];
          if (
            q.z > p.z - 0.5 &&
            q.z < p.z + plan.height - 0.5 &&
            q.x > p.x - 0.5 &&
            q.x < p.x + ex - 0.5 &&
            q.y > p.y - 0.5 &&
            q.y < p.y + ey - 0.5
          ) {
            pts.splice(k, 1);
          }
        }
        offerPoint(frontMax(p.x, plan.dx, p.y, plan.dy, p.z) + rowL, p.y, p.z);
        offerPoint(p.x, p.y + plan.dy + rowW, p.z);
        settled = true;
        break;
      }
      if (settled) continue;
    }
  }

  /* — разворот единиц (сохранённые и гнездовые пропускаются) — */
  const units: Unit[] = [];
  let totalUnits = 0;
  outer: for (const item of items) {
    if (nestedItemIds.has(item.id)) continue;
    for (let u = 0; u < item.quantity; u++) {
      if (keepKeys.has(`${item.id}:${u}`)) continue;
      if (totalUnits >= MAX_UNITS) {
        addUnplaced(item.id, item.quantity - u, "no-space");
        break outer;
      }
      units.push({ item, unitIndex: u, stopIndex: item.stopIndex });
      totalUnits++;
    }
  }

  /* — сортировка: LIFO по стопам (при lifo последняя точка — глубже), затем крупные/тяжёлые — */
  units.sort((a, b) => {
    if (a.stopIndex !== b.stopIndex) {
      return lifo ? b.stopIndex - a.stopIndex : a.stopIndex - b.stopIndex;
    }
    const ia = infoByItem.get(a.item.id)!;
    const ib = infoByItem.get(b.item.id)!;
    if (ia.volume !== ib.volume) return ib.volume - ia.volume;
    if (ia.area !== ib.area) return ib.area - ia.area;
    if (a.item.weight !== b.item.weight) return b.item.weight - a.item.weight;
    return a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0;
  });

  /* — слишком крупные грузы — */
  for (const u of units) {
    const info = infoByItem.get(u.item.id)!;
    if (info.tooBig) addUnplaced(u.item.id, 1, "too-big");
  }

  for (const unit of units) {
    const item = unit.item;
    const info = infoByItem.get(item.id)!;
    if (info.tooBig) continue; // уже помечено

    if (weightUsed + item.weight > vehicle.payload + EPS) {
      addUnplaced(item.id, 1, "weight-limit");
      continue;
    }

    // сортировка точек: z, затем x, затем y (полки поперёк ширины)
    const validPts = (keepFallback.length ? [...pts, ...keepFallback] : pts).filter(
      (p) =>
        p.x < L - wall - EPS &&
        p.y < W - wall - EPS &&
        p.z < H - EPS
    );
    validPts.sort((a, b) => {
      if (a.z !== b.z) return a.z - b.z;
      if (a.x !== b.x) return a.x - b.x;
      return a.y - b.y;
    });

    let done = false;
    for (const p of validPts) {
      if (p.z > 0 && !stacking) break; // точки отсортированы по z — дальше только выше

      for (const orient of info.orients) {
        const { dx, dy, dz, yaw, axis } = orient;

        if (
          p.x < wall - EPS ||
          p.y < wall - EPS ||
          p.x + dx > L - wall + EPS ||
          p.y + dy > W - wall + EPS ||
          p.z + dz > H + EPS
        ) {
          continue;
        }

        const ex = dx + rowL;
        const ey = dy + rowW;

        candidates.length = 0;
        grid.query(p.x, p.y, ex, ey, candidates);
        let collided = false;
        for (const i of candidates) {
          const b = placed[i];
          if (effOverlap(p.x, p.y, p.z, ex, ey, dz, b)) {
            collided = true;
            break;
          }
        }
        if (collided) continue;

        let layer = 0;
        let supportShares: Array<[number, number]> = [];
        let supporters: number[] = [];

        if (p.z > 0) {
          candidates.length = 0;
          grid.query(p.x, p.y, dx, dy, candidates);
          const counts = new Map<number, number>();
          const samples: Array<[number, number]> = [
            [0.1, 0.1],
            [0.9, 0.1],
            [0.1, 0.9],
            [0.9, 0.9],
            [0.5, 0.5],
          ];
          let supportedTotal = 0;
          for (const [fx, fy] of samples) {
            const px = p.x + dx * fx;
            const py = p.y + dy * fy;
            for (const i of candidates) {
              const b = placed[i];
              if (Math.abs(b.z + b.dz - p.z) > SUPPORT_EPS) continue;
              if (
                px >= b.x - 0.5 &&
                px <= b.x + b.dx + 0.5 &&
                py >= b.y - 0.5 &&
                py <= b.y + b.dy + 0.5
              ) {
                counts.set(i, (counts.get(i) ?? 0) + 1);
                supportedTotal++;
                break;
              }
            }
          }
          if (supportedTotal === 0 || supportedTotal < 3) continue;
          supporters = [...counts.keys()];
          supportShares = supporters.map((i) => [i, (counts.get(i) ?? 0) / supportedTotal]);

          let compatible = true;
          for (const i of supporters) {
            const b = placed[i];
            const si = itemById.get(b.itemId);
            if (!si || !si.stackable || si.maxTopLoad <= 0 || !b.flatTop || si.group !== item.group) {
              compatible = false;
              break;
            }
          }
          if (!compatible) continue;

          layer = Math.max(...supporters.map((i) => placed[i].layer)) + 1;
          if (maxLayers > 0 && layer >= maxLayers) continue;

          const closureSet = new Set<number>(supporters);
          const walk: number[] = supporters.slice();
          while (walk.length) {
            const i = walk.pop()!;
            for (const pi of placed[i].supporters) {
              if (!closureSet.has(pi)) {
                closureSet.add(pi);
                walk.push(pi);
              }
            }
          }
          const deltas = new Map<number, number>(supportShares);
          const order = [...closureSet].sort((a, b) => placed[b].z - placed[a].z);
          for (const i of order) {
            const d = deltas.get(i) ?? 0;
            if (d <= 0) continue;
            for (const [pi, frac] of placed[i].supportShares) {
              deltas.set(pi, (deltas.get(pi) ?? 0) + d * frac);
            }
          }
          let loadOk = true;
          for (const i of closureSet) {
            const b = placed[i];
            const si = itemById.get(b.itemId);
            const d = deltas.get(i) ?? 0;
            if (!si || b.loadAbove + item.weight * d > si.maxTopLoad + EPS) {
              loadOk = false;
              break;
            }
          }
          if (!loadOk) continue;
          for (const i of closureSet) {
            placed[i].loadAbove += item.weight * (deltas.get(i) ?? 0);
          }
        }

        /* — размещение — */
        const box: Box = {
          x: p.x,
          y: p.y,
          z: p.z,
          dx,
          dy,
          dz,
          ex,
          ey,
          itemId: item.id,
          unitIndex: unit.unitIndex,
          flatTop: !(item.shape === "cylinder" && axis === "side"),
          layer,
          loadAbove: 0,
          supportShares,
          supporters,
        };
        placed.push(box);
        grid.insert(placed.length - 1, box);
        weightUsed += item.weight;

        placements.push({
          id: `${item.id}:${unit.unitIndex}`,
          itemId: item.id,
          unitIndex: unit.unitIndex,
          x: Math.round(p.x),
          y: Math.round(p.y),
          z: Math.round(p.z),
          yaw,
          axis,
          stopIndex: item.stopIndex,
        });

        const usedIdx = pts.indexOf(p);
        if (usedIdx >= 0) pts.splice(usedIdx, 1);
        for (let k = pts.length - 1; k >= 0; k--) {
          const q = pts[k];
          if (
            q.z > p.z - 0.5 &&
            q.z < p.z + dz - 0.5 &&
            q.x > p.x - 0.5 &&
            q.x < p.x + ex - 0.5 &&
            q.y > p.y - 0.5 &&
            q.y < p.y + ey - 0.5
          ) {
            pts.splice(k, 1);
          }
        }

        offerPoint(frontMax(p.x, dx, p.y, dy, p.z) + rowL, p.y, p.z);
        offerPoint(p.x, p.y + dy + rowW, p.z);
        offerPoint(p.x, p.y, p.z + dz);
        offerPoint(frontMax(p.x, dx, p.y, dy, p.z) + rowL, anchorY, p.z);
        offerPoint(anchorX, p.y + dy + rowW, p.z);

        done = true;
        break;
      }
      if (done) break;
    }

    if (!done) addUnplaced(item.id, 1, "no-space");
  }

  /* — слои: уникальные z (с допуском 1 мм) — */
  const zSet = new Set<number>();
  for (const p of placements) zSet.add(p.z);
  const layerZs = [...zSet].sort((a, b) => a - b);
  const layers: LayerInfo[] = layerZs.map((z, index) => ({ index, z }));

  /* — агрегация неразмещённых по item — */
  const unplaced: Unplaced[] = [];
  for (const [key, v] of unplacedAgg) {
    const itemId = key.split("|")[0];
    unplaced.push({ itemId, quantity: v.qty, reason: v.reason });
  }
  unplaced.sort((a, b) => (a.itemId < b.itemId ? -1 : 1));

  return {
    placements,
    unplaced,
    layers,
    durationMs: Math.round((now() - t0) * 1000) / 1000,
  };
}

export function packLayout(req: PackRequest): PackResult {
  const forced = req.mode === "mixed" ? mixedSearch(req) : undefined;
  return packLayoutImpl(req, forced);
}