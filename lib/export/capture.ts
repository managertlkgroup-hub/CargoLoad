/**
 * Реестр WebGL-канваса для PNG-экспорта 3D-вида.
 * view3d.tsx регистрирует свой canvas (с preserveDrawingBuffer) при монтировании,
 * png.ts читает его в момент экспорта и принудительно перерисовывает сцену.
 */

export interface CapturedGL {
  canvas: HTMLCanvasElement;
  /** принудительный рендер текущей камеры (учитывает pending damping) */
  render: () => void;
}

let captured: CapturedGL | null = null;

/** Регистрация активного 3D-канваса; возвращает функцию отмены. */
export function registerCapture(entry: CapturedGL): () => void {
  captured = entry;
  return () => {
    if (captured === entry) captured = null;
  };
}

/** Текущий захваченный 3D-канвас (или null). */
export function getCapturedGL(): CapturedGL | null {
  return captured;
}