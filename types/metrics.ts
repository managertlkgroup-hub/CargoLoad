/** Метрики раскладки. Все значения уже округлены на границе вычисления. */

export interface BBox3 {
  length: number;
  width: number;
  height: number;
}

export interface AxleLoad {
  axleId: string;
  label: string;
  /** нагрузка с грузом, кг */
  loadKg: number;
  maxLoadKg: number;
  /** процент от допустимого, округлён до 0.1 */
  pct: number;
  /** превышение допустимой нагрузки */
  overloaded: boolean;
}

export interface CogInfo {
  /** абсолютный центр тяжести, мм */
  x: number;
  y: number;
  z: number;
  /** смещение вдоль длины, % от длины кузова (знак: + к задней стенке) */
  longitudinalPct: number;
  /** смещение по ширине, % (знак: + к правому борту) */
  lateralPct: number;
  level: "ok" | "warn" | "crit";
}

export interface UnplacedDetail {
  itemId: string;
  name: string;
  quantity: number;
  weight: number;
  /** габариты одной единицы, мм (для цилиндра — Ø×Ø×L при axis=up) */
  length: number;
  width: number;
  height: number;
  reason: string;
}

export interface LoadMetrics {
  /** объём кузова, м³ */
  volumeTotalM3: number;
  volumeUsedM3: number;
  volumeFreeM3: number;
  /** % заполнения объёма, округлено до 0.1 */
  volumePct: number;

  /** грузоподъёмность, кг */
  weightCapacityKg: number;
  weightUsedKg: number;
  weightFreeKg: number;
  /** % заполнения веса, округлено до 0.1 */
  weightPct: number;

  /** габариты укладки БЕЗ зазоров (объединение интервалов), мм */
  bboxNoGaps: BBox3;
  /** габариты укладки С учётом зазоров (раздутые боксы + стеновые), мм */
  bboxWithGaps: BBox3;

  /** можно ли штабелировать (есть слои > 0) */
  canStack: boolean;
  /** текущее число слоёв */
  currentLayers: number;
  /** максимально возможное число слоёв для данного кузова и грузов */
  maxLayers: number;

  /** погрузочные метры LDM = Σ(площадь пола м²) / 2.4 */
  ldm: number;
  /** занятая площадь пола, м² */
  floorAreaM2: number;

  cog: CogInfo;
  axles: AxleLoad[];
  axlesAvailable: boolean;

  placedCount: number;
  totalCount: number;
  unplaced: UnplacedDetail[];
}
