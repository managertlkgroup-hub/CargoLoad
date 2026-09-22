import { packLayout } from "@/lib/packing/core";
import type { PackRequest, PackResult } from "@/types";

/**
 * Запуск упаковки: Web Worker, синхронный фолбэк при его недоступности.
 * Один воркер на приложение, запросы мультиплексируются по id.
 */

interface Pending {
  resolve: (r: PackResult) => void;
  reject: (e: Error) => void;
  req: PackRequest;
}

let worker: Worker | null = null;
let broken = false;
let seq = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (broken || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./pack.worker.ts", import.meta.url));
    worker.onmessage = (e: MessageEvent<{ id: number; result?: PackResult; error?: string }>) => {
      const { id, result, error } = e.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (result) p.resolve(result);
      else p.reject(new Error(error ?? "Worker error"));
    };
    worker.onerror = () => {
      // воркер недоступен — деградируем до синхронного расчёта
      broken = true;
      const failed = [...pending.entries()];
      worker?.terminate();
      worker = null;
      for (const [id, p] of failed) {
        pending.delete(id);
        try {
          p.resolve(packLayout(p.req));
        } catch (err) {
          p.reject(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };
    return worker;
  } catch {
    broken = true;
    return null;
  }
}

/** Асинхронная упаковка: воркер, либо синхронный фолбэк. */
export function packAsync(req: PackRequest): Promise<PackResult> {
  const w = getWorker();
  if (!w) {
    return new Promise((resolve, reject) => {
      try {
        resolve(packLayout(req));
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }
  const id = ++seq;
  return new Promise<PackResult>((resolve, reject) => {
    pending.set(id, { resolve, reject, req });
    w.postMessage({ id, req });
  });
}

/** Дождаться досшивания всех текущих расчётов (для тестов/экспорта). */
export function hasPendingPacks(): boolean {
  return pending.size > 0;
}
