import { genId } from "@/lib/id";
import type { CargoItem } from "@/types";

/** Паллетизация коробок: раскладка на поддон с поворотом в слое. */

export interface PalletPreset {
  id: string;
  name: string;
  nameEn: string;
  length: number;
  width: number;
  maxHeight: number;
  maxWeight: number;
}

export const PALLET_PRESETS: PalletPreset[] = [
  {
    id: "pallet.eur",
    name: "Европаллета",
    nameEn: "Euro pallet",
    length: 1200,
    width: 800,
    maxHeight: 1400,
    maxWeight: 1000,
  },
  {
    id: "pallet.iso",
    name: "Промышленная паллета",
    nameEn: "Industrial pallet",
    length: 1200,
    width: 1000,
    maxHeight: 1600,
    maxWeight: 1500,
  },
  {
    id: "pallet.half",
    name: "Половинная паллета",
    nameEn: "Half pallet",
    length: 800,
    width: 600,
    maxHeight: 1400,
    maxWeight: 700,
  },
];

export function findPallet(id: string): PalletPreset {
  return PALLET_PRESETS.find((p) => p.id === id) ?? PALLET_PRESETS[0];
}

export interface PalletizeOptions {
  boxLength: number;
  boxWidth: number;
  boxHeight: number;
  boxWeight: number;
  quantity: number;
  preset?: PalletPreset;
  allowRotate?: boolean;
  group?: string;
  color?: string;
}

export interface PalletizeResult {
  items: CargoItem[];
  boxesPerPallet: number;
  fullLayers: number;
  palletCount: number;
  unitLength: number;
  unitWidth: number;
  unitHeight: number;
}

export function palletizeBoxes(opts: PalletizeOptions): PalletizeResult {
  const preset = opts.preset ?? PALLET_PRESETS[0];
  const rotate = opts.allowRotate ?? true;

  const orient = (bx: number, by: number) => ({
    perX: Math.max(0, Math.floor(preset.length / bx)),
    perY: Math.max(0, Math.floor(preset.width / by)),
  });

  const along = orient(opts.boxLength, opts.boxWidth);
  const perAlong = along.perX * along.perY;
  const rotated = rotate ? orient(opts.boxWidth, opts.boxLength) : { perX: 0, perY: 0 };
  const perRot = rotated.perX * rotated.perY;

  const useRot = perRot > perAlong;
  const perLayer = Math.max(1, useRot ? perRot : perAlong);

  const heightLimit = Math.max(1, Math.floor(preset.maxHeight / opts.boxHeight));
  const byWeight = Math.floor(preset.maxWeight / (perLayer * opts.boxWeight));
  const fullLayers = Math.max(1, Math.min(heightLimit, byWeight));
  const boxesPerPallet = perLayer * fullLayers;

  const palletCount = Math.max(1, Math.ceil(opts.quantity / boxesPerPallet));
  const unitHeight = fullLayers * opts.boxHeight;

  const item: CargoItem = {
    id: genId("pallet"),
    name: `${preset.name} ×${boxesPerPallet}`,
    shape: "box",
    length: preset.length,
    width: preset.width,
    height: unitHeight,
    diameter: 0,
    weight: boxesPerPallet * opts.boxWeight,
    quantity: palletCount,
    stackable: true,
    maxTopLoad: preset.maxWeight,
    group: opts.group ?? "general",
    color: opts.color ?? "#10B981",
    cylinderAxis: "up",
    stopIndex: 0,
  };

  return {
    items: [item],
    boxesPerPallet,
    fullLayers,
    palletCount,
    unitLength: preset.length,
    unitWidth: preset.width,
    unitHeight,
  };
}