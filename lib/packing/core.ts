import { COLLISION_EPS } from "@/lib/constants";
import { dimsFor, orientationsFor, type Geom } from "@/lib/geometry";
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
 * LIFO-приоритетом мульти-стопа и учётом стороны загрузки.
 *
 * Инварианты:
 *  - пересечение грузов запрещено, касание разрешено (допуск eps);
 *  - зазоры от стен (wall) — по 4 боковым стенам, вертикально пол/потолок чётко;
 *  - зазоры между рядами (rowLength по X, rowWidth по Y) — per-mode;
 *  - груз в пределах [wall, L−wall] × [wall, W−wall] по XY и [0, H] по Z;
 *  - стек: только в группе совместимости, через плоскую опору, с учётом
 *    макс. нагрузки сверху по всей цепочке опор.
 *
 * Производительность: пространственная хеш-сетка для коллизий,
 * доминирование точек (Pareto-фронтир), каппа единиц MAX_UNITS.
 */

const MAX_UNITS = 6000;
const EPS = COLLISION_EPS;
const SUPPORT_EPS = 1.5;

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

/** Добавление точки с доминированием (Pareto): худшие отбрасываются. */
function addPoint(pts: Pt[], p: Pt): void {
  const e = EPS;
  for (const q of pts) {
    if (q.x <= p.x + e && q.y <= p.y + e && q.z <= p.z + e) return;
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

/* ----------------------------- основной алгоритм ----------------------------- */

export function packLayout(req: PackRequest): PackResult {
  const t0 = now();
  const { items, vehicle, mode, gaps, stacking, maxLayers, lifo, loadingSide } = req;

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

  /* — сторона загрузки: flipY для левого борта, основная ось заполнения — */
  const flipY = loadingSide === "left";
  const primaryIsY = loadingSide === "right" || loadingSide === "left";

  /* — предварительные данные по каждому типу груза — */
  interface ItemInfo {
    geom: Geom;
    orients: Array<{ yaw: Yaw; axis: CylinderAxis; dx: number; dy: number; dz: number }>;
    tooBig: boolean;
    volume: number;
    area: number;
  }
  const infoByItem = new Map<string, ItemInfo>();

  for (const item of items) {
    const orients = orientationsFor(item, mode).map((o) => {
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

  /* — разворот единиц — */
  const units: Unit[] = [];
  let totalUnits = 0;
  outer: for (const item of items) {
    for (let u = 0; u < item.quantity; u++) {
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

  /* — якорь заполнения (в «пространственных» координатах после flipY) — */
  const anchorX = wall;
  const anchorY = wall;

  const placed: Box[] = [];
  const grid = new Grid();
  const pts: Pt[] = [{ x: anchorX, y: anchorY, z: 0 }];
  const placements: Placement[] = [];
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
  const offerPoint = (x: number, y: number, z: number) => {
    const q: Pt = { x, y, z };
    if (!deadPoint(q)) addPoint(pts, q);
  };

  for (const unit of units) {
    const item = unit.item;
    const info = infoByItem.get(item.id)!;
    if (info.tooBig) continue; // уже помечено

    // предел грузоподъёмности
    if (weightUsed + item.weight > vehicle.payload + EPS) {
      addUnplaced(item.id, 1, "weight-limit");
      continue;
    }

    // сортировка точек: z, затем вдоль основной оси заполнения
    // (задняя/верхняя дверь — ряды вдоль X: сначала меньший Y;
    //  боковые двери — столбцы вдоль Y: сначала меньший X)
    const validPts = pts.filter(
      (p) =>
        p.x < L - wall - EPS &&
        p.y < W - wall - EPS &&
        p.z < H - EPS
    );
    validPts.sort((a, b) => {
      if (a.z !== b.z) return a.z - b.z;
      if (primaryIsY) {
        if (a.x !== b.x) return a.x - b.x;
        return a.y - b.y;
      }
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });

    let done = false;
    for (const p of validPts) {
      if (p.z > 0 && !stacking) break; // точки отсортированы по z — дальше только выше

      for (const orient of info.orients) {
        const { dx, dy, dz, yaw, axis } = orient;

        // границы кузова (реальный бокс, стены только боковые)
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

        // коллизии (эффективные боксы с зазорами рядов)
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

        // опора и штабелирование
        let layer = 0;
        let supportShares: Array<[number, number]> = [];
        let supporters: number[] = [];

        if (p.z > 0) {
          // собираем опоры: пересечение по XY с вершиной на высоте p.z
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
          if (supportedTotal === 0 || supportedTotal < 3) continue; // < 50% опоры
          supporters = [...counts.keys()];
          supportShares = supporters.map((i) => [i, (counts.get(i) ?? 0) / supportedTotal]);

          // совместимость опор: плоская верх, та же группа, стекинг разрешён
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

          // полная цепочка опор вниз (без двойного обхода): множество узлов,
          // затем распределение нагрузки вниз по убыванию z
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
          // проверка макс. нагрузки по всей цепочке (доля веса единицы)
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
          // закрепляем нагрузку
          for (const i of closureSet) {
            placed[i].loadAbove += item.weight * (deltas.get(i) ?? 0);
          }
        }

        /* — размещение — */
        const realY = flipY ? W - p.y - dy : p.y;
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
          y: Math.round(realY),
          z: Math.round(p.z),
          yaw,
          axis,
          stopIndex: item.stopIndex,
        });

        // новые точки (только живые)
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

        offerPoint(p.x + dx + rowL, p.y, p.z);
        offerPoint(p.x, p.y + dy + rowW, p.z);
        offerPoint(p.x, p.y, p.z + dz);
        offerPoint(p.x + dx + rowL, anchorY, p.z);
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
