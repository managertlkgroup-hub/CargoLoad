import type { CargoItem } from "@/types/cargo";
import type { GapsByMode, PackMode, Placement } from "@/types/packing";
import type { LoadingSide } from "@/types/vehicle";

/** Остановка разгрузки (мульти-стоп). */
export interface LoadStop {
  id: string;
  name: string;
}

/** Данные сохраняемой/загружаемой сессии. */
export interface SessionData {
  items: CargoItem[];
  vehicleId: string;
  mode: PackMode;
  gaps: GapsByMode;
  placements: Placement[];
  stops: LoadStop[];
  loadingSide: LoadingSide;
}

export interface SavedSession {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  data: SessionData;
}
