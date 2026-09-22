import { packLayout } from "@/lib/packing/core";
import type { PackRequest, PackResult } from "@/types";

/** Web Worker: упаковка вне главного потока (100 грузов < 1 c). */

interface ReqMsg {
  id: number;
  req: PackRequest;
}

interface ResMsg {
  id: number;
  result?: PackResult;
  error?: string;
}

self.onmessage = (e: MessageEvent<ReqMsg>) => {
  const { id, req } = e.data;
  try {
    const result = packLayout(req);
    const msg: ResMsg = { id, result };
    self.postMessage(msg);
  } catch (err) {
    const msg: ResMsg = { id, error: err instanceof Error ? err.message : String(err) };
    self.postMessage(msg);
  }
};
