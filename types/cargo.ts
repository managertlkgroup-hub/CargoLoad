/** Типы грузов CargoPlanner. Все линейные размеры — в миллиметрах, вес — в кг. */

export type CargoShape = "box" | "cylinder" | "oversize";

/** Ориентация цилиндра: вертикально (опирается на торец) или лёжа (на образующей). */
export type CylinderAxis = "up" | "side";

export interface CargoItem {
  id: string;
  name: string;
  shape: CargoShape;
  /** мм: для box/oversize — длина (X); для цилиндра — длина L (высота при axis=up) */
  length: number;
  /** мм: для box/oversize — ширина (Y); для цилиндра не используется (берётся diameter) */
  width: number;
  /** мм: для box/oversize — высота (Z); для цилиндра не используется (берётся diameter) */
  height: number;
  /** мм: диаметр цилиндра Ø (для box/oversize = 0) */
  diameter: number;
  /** кг на единицу */
  weight: number;
  /** количество единиц (1..10000) */
  quantity: number;
  /** можно ли класть другие грузы сверху */
  stackable: boolean;
  /** макс. допустимая нагрузка сверху, кг (0 — ничего сверху нельзя) */
  maxTopLoad: number;
  /** группа совместимости: штабелируются только одинаковые группы */
  group: string;
  /** HEX-цвет для 2D/3D и легенды */
  color: string;
  /** ориентация цилиндра по умолчанию (для box/oversize игнорируется) */
  cylinderAxis: CylinderAxis;
  /** индекс точки выгрузки (мульти-стоп), 0..N-1 */
  stopIndex: number;
  /** id пресета, из которого создан (если из пресета) */
  presetId?: string;
}

/** Пресет груза (встроенный или пользовательский). */
export interface CargoPreset {
  id: string;
  /** отображаемое имя (RU) */
  name: string;
  /** отображаемое имя (EN) */
  nameEn: string;
  builtin: boolean;
  /** цвет-маркер пресета в списке */
  data: Omit<CargoItem, "id" | "presetId">;
}

export type CargoItemDraft = Omit<CargoItem, "id"> & { id?: string };
