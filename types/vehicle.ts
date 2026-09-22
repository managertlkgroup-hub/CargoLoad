/** Типы транспорта. Размеры — мм, вес — кг. */

/** Сторона загрузки/выгрузки. */
export type LoadingSide = "rear" | "right" | "left" | "top";

export interface Axle {
  id: string;
  label: string;
  /**
   * Позиция оси вдоль кузова, мм; 0 — передняя стенка кузова,
   * отрицательные значения — оси тягача перед кузовом.
   */
  position: number;
  /** допустимая нагрузка на ось, кг */
  maxLoad: number;
  /** доля снаряжённой массы (сумма по осям = 1) */
  tareShare: number;
}

export interface VehicleSpec {
  id: string;
  /** имя на RU */
  name: string;
  /** имя на EN */
  nameEn: string;
  builtin: boolean;
  /** внутренняя длина кузова, мм (по X) */
  innerLength: number;
  /** внутренняя ширина кузова, мм (по Y) */
  innerWidth: number;
  /** внутренняя высота кузова, мм (по Z) */
  innerHeight: number;
  /** грузоподъёмность, кг */
  payload: number;
  /** снаряжённая масса (для осевых нагрузок), кг; 0 — не учитывать */
  tare: number;
  /** оси (для расчёта осевых нагрузок); пусто — расчёт осей недоступен */
  axles: Axle[];
  /** схема: рама или тягач+полуприцеп */
  axleLayout: "rigid" | "tractor-semi";
  /** доступные стороны загрузки */
  loadingSides: LoadingSide[];
  /** сторона загрузки по умолчанию */
  defaultLoadingSide: LoadingSide;
  /** короткое описание типа (напр. «Тент», «Рефрижератор») */
  bodyType: string;
}

export type VehicleDraft = Omit<VehicleSpec, "id"> & { id?: string };
