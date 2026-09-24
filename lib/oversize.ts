import { dimsBase, type Geom } from "@/lib/geometry";

/**
 * Физически груз больше кузова: хотя бы один габарит (в базовой ориентации)
 * строго превышает внутренние габариты автомобиля. Только физика — флаг
 * isOversize юзер решает сам, поэтому детект используется лишь для
 * подтверждения при добавлении.
 */
export function exceedsVehicleDims(
  geom: Geom,
  innerLength: number,
  innerWidth: number,
  innerHeight: number
): boolean {
  const { dx, dy, dz } = dimsBase(geom);
  return dx > innerLength || dy > innerWidth || dz > innerHeight;
}

/**
 * Груз считается негабаритным: юзер-флаг или legacy-форма «oversize»
 * (существовавшая до появления чекбокса; сохранённые раскладки и пресеты
 * из старых версий могут иметь старую форму).
 */
export function isOversizeItem(item: {
  shape: string;
  isOversize?: boolean;
}): boolean {
  return item.isOversize === true || item.shape === "oversize";
}