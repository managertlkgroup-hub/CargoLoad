"use client";

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  List,
  Magnet,
  RotateCw,
  Ruler,
  SquareStack,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useT } from "@/hooks/use-t";
import { useVehicle } from "@/hooks/use-vehicle";
import { GRID_SIZES, SNAP_THRESHOLDS } from "@/lib/constants";
import { dimsFor, topViewShape } from "@/lib/geometry";
import { formatLength } from "@/lib/units";
import { boxesFor, placementBox, validateMove, type Box3 } from "@/lib/packing/collide";
import { snapPosition, type SnapAlign } from "@/lib/view/snap";
import { computeViewZones, dimLabels } from "@/lib/view/zones";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/store/use-layout-store";
import { useUiStore } from "@/store/use-ui-store";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LayerControls } from "@/components/views/layer-controls";
import type { CargoItem, Placement } from "@/types";

const PAD_PX = 58;

/**
 * Вид сверху. Drag-and-drop через dnd-kit (activation distance 8px —
 * грузы не «прилипают» к курсору), live-проверка коллизий: касание
 * разрешено, запрещено только пересечение по площади; при пересечении
 * удерживается последняя валидная позиция, снап привёл бы в коллизию —
 * груз продолжает следовать за мышью по сырой позиции (ТЗ B1).
 * Snap-to-grid включается только в пределах 50 мм от ребра соседа/стены,
 * примагниченный край подсвечивается. Подписи размеров кузова привязаны
 * к прямоугольнику кузова (ТЗ B2). Легенда — в выделенной зоне.
 */
export default function View2D() {
  const t = useT();
  const vehicle = useVehicle();

  const items = useLayoutStore((s) => s.items);
  const placements = useLayoutStore((s) => s.placements);
  const layers = useLayoutStore((s) => s.layers);
  const selectedIds = useLayoutStore((s) => s.selectedIds);
  const select = useLayoutStore((s) => s.select);
  const clearSelection = useLayoutStore((s) => s.clearSelection);
  const movePlacement = useLayoutStore((s) => s.movePlacement);
  const rotatePlacement = useLayoutStore((s) => s.rotatePlacement);
  const changeItemLayer = useLayoutStore((s) => s.changeItemLayer);
  const duplicateItems = useLayoutStore((s) => s.duplicateItems);
  const removeItems = useLayoutStore((s) => s.removeItems);
  const loadingSide = useLayoutStore((s) => s.loadingSide);
  const mode = useLayoutStore((s) => s.mode);
  const wall = useLayoutStore((s) => s.gaps[mode].wall);

  const activeLayer = useUiStore((s) => s.activeLayer);
  const setActiveLayer = useUiStore((s) => s.setActiveLayer);
  const snapEnabled = useUiStore((s) => s.snapEnabled);
  const setSnapEnabled = useUiStore((s) => s.setSnapEnabled);
  const snapThreshold = useUiStore((s) => s.snapThreshold);
  const setSnapThreshold = useUiStore((s) => s.setSnapThreshold);
  const gridSize = useUiStore((s) => s.gridSize);
  const setGridSize = useUiStore((s) => s.setGridSize);
  const showLegend = useUiStore((s) => s.showLegend);
  const toggleLegend = useUiStore((s) => s.toggleLegend);
  const showDimensions = useUiStore((s) => s.showDimensions);
  const toggleDimensions = useUiStore((s) => s.toggleDimensions);
  const locale = useUiStore((s) => s.locale);
  const lengthUnit = useUiStore((s) => s.lengthUnit);

  /* магнит включён, только когда выбран ненулевой порог */
  const snapOn = snapEnabled && snapThreshold > 0;

  /* — размер контейнера — */
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 960, h: 640 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      if (r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const L = vehicle.innerLength;
  const W = vehicle.innerWidth;
  const pad = showDimensions ? PAD_PX : 28;
  const scale = Math.max(
    0.001,
    Math.min((size.w - pad * 2) / L, (size.h - pad * 2) / W)
  );
  const bodyW = L * scale;
  const bodyH = W * scale;
  const ox = Math.round((size.w - bodyW) / 2);
  const oy = Math.round((size.h - bodyH) / 2);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const layerIndexOf = (z: number) => layers.findIndex((l) => Math.abs(l.z - z) < 1);
  const visible =
    activeLayer === -1
      ? placements
      : placements.filter((p) => layerIndexOf(p.z) === activeLayer);

  const legendRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of visible) counts.set(p.itemId, (counts.get(p.itemId) ?? 0) + 1);
    const rows: Array<{ item: CargoItem; n: number }> = [];
    for (const [id, n] of counts) {
      const item = itemById.get(id);
      if (item) rows.push({ item, n });
    }
    return rows;
  }, [visible, itemById]);

  const zones = computeViewZones(size.w, size.h, legendRows.length);

  /* подписи размеров привязаны к кузову (ТЗ B2) */
  const lenLabel = formatLength(L, lengthUnit, locale);
  const widLabel = formatLength(W, lengthUnit, locale);
  const dims = showDimensions
    ? { ...dimLabels({ ox, oy, w: bodyW, h: bodyH }, lenLabel, widLabel), lenText: lenLabel, widText: widLabel }
    : null;

  /* — сетка — */
  const gridStep = useMemo(() => {
    let g = gridSize;
    const px = g * scale;
    if (px < 7) g = g * Math.ceil(7 / Math.max(px, 0.0001));
    return g;
  }, [gridSize, scale]);

  const vLines: number[] = [];
  const hLines: number[] = [];
  if (snapOn) {
    for (let x = gridStep; x < L && vLines.length < 300; x += gridStep) vLines.push(x);
    for (let y = gridStep; y < W && hLines.length < 300; y += gridStep) hLines.push(y);
  }

  /* — drag & drop — */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  const [preview, setPreview] = useState<{
    id: string;
    x: number;
    y: number;
    align: SnapAlign | null;
  } | null>(null);
  const previewRef = useRef(preview);
  const dragMeta = useRef<{ startX: number; startY: number } | null>(null);
  const scaleRef = useRef(scale);
  // синхронизация ref'ов только в эффекте (правило react-hooks/refs)
  useEffect(() => {
    previewRef.current = preview;
    scaleRef.current = scale;
  }, [preview, scale]);
  const [ctxId, setCtxId] = useState<string | null>(null);

  const geomContext = (excludeId: string, sameLayerZ?: number): Box3[] => {
    const st = useLayoutStore.getState();
    const boxes = boxesFor(st.placements, itemById, new Set([excludeId]));
    if (sameLayerZ === undefined) return boxes;
    return boxes.filter((b) => Math.abs(b.z - sameLayerZ) < 1);
  };

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id).replace(/^pl:/, "");
    const p = useLayoutStore.getState().placements.find((pl) => pl.id === id);
    if (!p) return;
    dragMeta.current = { startX: p.x, startY: p.y };
    setPreview({ id, x: p.x, y: p.y, align: null });
  };

  const onDragMove = (e: DragMoveEvent) => {
    const meta = dragMeta.current;
    if (!meta) return;
    const id = String(e.active.id).replace(/^pl:/, "");
    const st = useLayoutStore.getState();
    const p = st.placements.find((pl) => pl.id === id);
    const item = p ? itemById.get(p.itemId) : undefined;
    if (!p || !item) return;

    const s = scaleRef.current;
    const rawX = meta.startX + e.delta.x / s;
    const rawY = meta.startY + e.delta.y / s;
    const d = dimsFor(item, p.yaw, p.axis);

    const snapped = snapPosition(rawX, rawY, {
      L,
      W,
      wall,
      dx: d.dx,
      dy: d.dy,
      others: geomContext(p.id, p.z),
      grid: gridSize,
      enabled: snapOn,
      threshold: snapThreshold,
    });

    const others = geomContext(p.id);

    // ТЗ B1: касание разрешено, запрещено только пересечение. Если снап привёл
    // бы в коллизию — пробуем сырую позицию мыши; валидна — следуем за мышью
    // (никакого «прилипания»). Иначе держим последнюю валидную позицию.
    const candidate = placementBox(item, { ...p, x: snapped.x, y: snapped.y });
    const res = validateMove(
      candidate,
      others,
      { dx: L, dy: W, dz: vehicle.innerHeight },
      false
    );
    if (res.ok) {
      setPreview({ id, x: snapped.x, y: snapped.y, align: snapped.align });
      return;
    }

    const rawRounded = { x: Math.round(rawX), y: Math.round(rawY) };
    const rawCandidate = placementBox(item, { ...p, x: rawRounded.x, y: rawRounded.y });
    const rawRes = validateMove(
      rawCandidate,
      others,
      { dx: L, dy: W, dz: vehicle.innerHeight },
      false
    );
    if (rawRes.ok) setPreview({ id, x: rawRounded.x, y: rawRounded.y, align: null });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id).replace(/^pl:/, "");
    const meta = dragMeta.current;
    const prev = previewRef.current;
    dragMeta.current = null;
    setPreview(null);
    if (!meta || !prev || prev.id !== id) return;
    if (prev.x === meta.startX && prev.y === meta.startY) return;
    const res = movePlacement(id, prev.x, prev.y);
    if (!res.ok) toast.error(res.error ?? t("toast.moveFail"));
  };

  const selectedItemId = selectedIds[0];

  const doChangeLayer = (direction: -1 | 1) => {
    if (!selectedItemId) return;
    const res = changeItemLayer(selectedItemId, direction);
    if (!res.ok) toast.error(res.error ?? t("toast.moveFail"));
  };

  const ctxPlacement = ctxId
    ? placements.find((p) => p.id === ctxId) ?? null
    : null;
  const ctxItem = ctxPlacement ? itemById.get(ctxPlacement.itemId) : undefined;

  /* — пустое состояние — */
  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="rounded-2xl bg-primary/12 p-4">
          <SquareStack className="size-8 text-primary" />
        </div>
        <p className="text-sm font-medium text-fg-2">{t("empty.2d.title")}</p>
        <p className="max-w-sm text-xs leading-relaxed text-muted">{t("empty.2d.text")}</p>
      </div>
    );
  }

  const hiddenByLayer = visible.length === 0 && placements.length > 0;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={wrapRef}
          className="absolute inset-0"
          onClick={(e) => {
            if (!(e.target as Element).closest("[data-cargo]")) clearSelection();
          }}
        >
          <svg
            width="100%"
            height="100%"
            className="block touch-none select-none"
            aria-label={t("view.2d")}
          >
            <defs>
              <linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.16" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.09" />
              </linearGradient>
              <clipPath id="bodyClip">
                <rect x={ox} y={oy} width={bodyW} height={bodyH} rx={14} />
              </clipPath>
            </defs>

            {/* сетка */}
            {snapOn && (
              <g clipPath="url(#bodyClip)" pointerEvents="none">
                {vLines.map((x) => (
                  <line
                    key={`v${x}`}
                    x1={ox + x * scale}
                    y1={oy}
                    x2={ox + x * scale}
                    y2={oy + bodyH}
                    stroke="var(--border-strong)"
                    strokeWidth={0.5}
                    opacity={0.5}
                  />
                ))}
                {hLines.map((y) => (
                  <line
                    key={`h${y}`}
                    x1={ox}
                    y1={oy + y * scale}
                    x2={ox + bodyW}
                    y2={oy + y * scale}
                    stroke="var(--border-strong)"
                    strokeWidth={0.5}
                    opacity={0.5}
                  />
                ))}
              </g>
            )}

            {/* кузов */}
            <rect
              x={ox}
              y={oy}
              width={bodyW}
              height={bodyH}
              rx={14}
              fill="url(#bodyGrad)"
              stroke="var(--border-strong)"
              strokeWidth={1.5}
              onClick={() => clearSelection()}
            />

            {/* рабочая зона (стеновые зазоры) */}
            {wall > 0 && wall * scale > 1.5 && (
              <rect
                x={ox + wall * scale}
                y={oy + wall * scale}
                width={Math.max(0, bodyW - wall * 2 * scale)}
                height={Math.max(0, bodyH - wall * 2 * scale)}
                rx={8}
                fill="none"
                stroke="var(--accent)"
                strokeOpacity={0.45}
                strokeWidth={1}
                strokeDasharray="7 5"
                pointerEvents="none"
              />
            )}

            {/* маркер стороны загрузки */}
            <DoorMarker side={loadingSide} ox={ox} oy={oy} bodyW={bodyW} bodyH={bodyH} label={t("view.door")} />

            {/* грузы */}
            <DndContext
              sensors={sensors}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
            >
              {visible.map((p) => {
                const item = itemById.get(p.itemId);
                if (!item) return null;
                const d = dimsFor(item, p.yaw, p.axis);
                const isPreview = preview?.id === p.id;
                const px = isPreview ? preview!.x : p.x;
                const py = isPreview ? preview!.y : p.y;
                return (
                  <CargoUnit
                    key={p.id}
                    placement={p}
                    item={item}
                    rect={{
                      x: ox + px * scale,
                      y: oy + py * scale,
                      w: d.dx * scale,
                      h: d.dy * scale,
                    }}
                    selected={selectedIds.includes(p.itemId)}
                    shape={topViewShape(item, p.axis)}
                    align={isPreview ? preview!.align : null}
                    onSelect={(additive) => select(p.itemId, additive)}
                    onRotate={() => {
                      const res = rotatePlacement(p.id);
                      if (!res.ok) toast.error(res.error ?? t("toast.moveFail"));
                    }}
                    onContextMenuOpen={() => setCtxId(p.id)}
                  />
                );
              })}
            </DndContext>

            {/* подписи размеров кузова (ТЗ B2): привязаны к кузову, отступ 10px,
                при нехватке места шрифт уменьшается до 11px, не отрываясь */}
            {dims && (
              <g pointerEvents="none" fill="var(--muted)" fontWeight={600}>
                <text x={dims.len.x} y={dims.len.y} textAnchor="middle" fontSize={dims.len.fontSize}>
                  {dims.lenText}
                </text>
                <text
                  x={dims.wid.x}
                  y={dims.wid.y}
                  textAnchor="middle"
                  fontSize={dims.wid.fontSize}
                  transform={`rotate(-90 ${dims.wid.x} ${dims.wid.y})`}
                >
                  {dims.widText}
                </text>
              </g>
            )}
          </svg>

          {/* скрытый слой */}
          {hiddenByLayer && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="glass-strong rounded-xl px-4 py-2 text-xs text-muted">
                {t("layer.n", { n: activeLayer + 1 })} — {t("metric.placed")}: 0
              </span>
            </div>
          )}

          {/* легенда — своя зона (тест непересечения с подписями размеров) */}
          {showLegend && legendRows.length > 0 && (
            <div
              className="glass-strong absolute rounded-xl px-3 py-2"
              style={{
                left: zones.legend.x,
                top: zones.legend.y,
                width: zones.legend.w,
                maxHeight: zones.legend.h,
              }}
            >
              <div className="mb-1 text-[9.5px] font-semibold tracking-[0.14em] text-muted uppercase">
                {t("legend.title")}
              </div>
              <ul className="space-y-0.5">
                {legendRows.slice(0, 6).map(({ item, n }) => (
                  <li key={item.id} className="flex items-center gap-1.5 text-[11px]">
                    <span
                      className="size-2.5 shrink-0 rounded-[3px]"
                      style={{ background: item.color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-fg-2">{item.name}</span>
                    <span className="tnum shrink-0 text-muted">
                      ×{n} {t("cargo.qty")}
                    </span>
                  </li>
                ))}
                {legendRows.length > 6 && (
                  <li className="pl-4 text-[10.5px] text-muted">
                    {t("legend.more", { n: legendRows.length - 6 })}
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* панель управления видом */}
          <div className="absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-2">
            <div className="glass-strong flex items-center gap-1 rounded-xl p-1">
              <LayerControls />
            </div>

            <div className="glass-strong flex items-center gap-1 rounded-xl p-1">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={cn(
                          "h-7 gap-1.5 px-2.5 text-[11.5px]",
                          snapOn && "bg-accent/15 text-accent"
                        )}
                        aria-label={t("snap.title")}
                      >
                        <Magnet className="size-4 shrink-0" />
                        <span className="max-w-[120px] truncate">
                          {t("snap.title")}:{" "}
                          {snapThreshold === 0 ? t("snap.off") : formatLength(snapThreshold, "mm", locale)}
                        </span>
                        <ChevronDown className="size-3 shrink-0 text-muted" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px]">
                    <p>{t("snap.thresholdHint")}</p>
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-44">
                  {SNAP_THRESHOLDS.map((th) => (
                    <DropdownMenuItem
                      key={th}
                      onClick={() => {
                        setSnapThreshold(th);
                        if (th === 0) setSnapEnabled(false);
                        else setSnapEnabled(true);
                      }}
                    >
                      <span className="flex-1">
                        {th === 0 ? t("snap.off") : formatLength(th, "mm", locale)}
                      </span>
                      {snapThreshold === th && <Check className="size-3.5 text-accent" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Select
                value={String(gridSize)}
                onValueChange={(v) =>
                  setGridSize(Number(v) as (typeof GRID_SIZES)[number])
                }
              >
                <SelectTrigger
                  className="h-7 w-[84px] rounded-lg px-2 text-[11.5px]"
                  aria-label={t("snap.grid")}
                  disabled={!snapOn}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRID_SIZES.map((g) => (
                    <SelectItem key={g} value={String(g)}>
                      {formatLength(g, lengthUnit, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="icon-sm"
                variant="ghost"
                className={cn(showLegend && "bg-primary/15 text-primary")}
                title={t("legend.title")}
                aria-label={t("legend.title")}
                onClick={toggleLegend}
              >
                <List className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className={cn(showDimensions && "bg-primary/15 text-primary")}
                title={t("dims.title")}
                aria-label={t("dims.title")}
                onClick={toggleDimensions}
              >
                <Ruler className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        <ContextMenuItem disabled={!ctxItem} onSelect={() => ctxPlacement && onRotateCtx()}>
          <RotateCw className="size-4" />
          {t("layer.rotate")}
          <ContextMenuShortcut>R</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled={!ctxItem} onSelect={() => doChangeLayer(1)}>
          <ChevronUp className="size-4" />
          {t("layer.up")}
        </ContextMenuItem>
        <ContextMenuItem disabled={!ctxItem} onSelect={() => doChangeLayer(-1)}>
          <ChevronDown className="size-4" />
          {t("layer.down")}
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!ctxItem}
          onSelect={() => ctxPlacement && setActiveLayer(layerIndexOf(ctxPlacement.z))}
        >
          <SquareStack className="size-4" />
          {t("ctx.showLayer")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          disabled={!ctxItem}
          onSelect={() => {
            if (!ctxItem) return;
            duplicateItems([ctxItem.id]);
            toast(t("toast.duplicated"));
          }}
        >
          <Copy className="size-4" />
          {t("cargo.duplicate")}
          <ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!ctxItem}
          onSelect={() => {
            if (!ctxItem) return;
            removeItems([ctxItem.id]);
            clearSelection();
            toast(t("toast.removed"));
          }}
        >
          <Trash2 className="size-4" />
          {t("cargo.delete")}
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );

  function onRotateCtx() {
    if (!ctxPlacement) return;
    const res = rotatePlacement(ctxPlacement.id);
    if (!res.ok) toast.error(res.error ?? t("toast.moveFail"));
  }
}

/* ----------------------------- единица груза ----------------------------- */

function CargoUnit({
  placement,
  item,
  rect,
  selected,
  shape,
  align,
  onSelect,
  onRotate,
  onContextMenuOpen,
}: {
  placement: Placement;
  item: CargoItem;
  rect: { x: number; y: number; w: number; h: number };
  selected: boolean;
  shape: "circle" | "rect";
  align: SnapAlign | null;
  onSelect: (additive: boolean) => void;
  onRotate: () => void;
  onContextMenuOpen: () => void;
}) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `pl:${placement.id}`,
  });
  // dnd-kit типизирует ref под HTMLElement — для SVG-группы приводим тип
  const svgRef = (el: SVGGElement | null) => setNodeRef(el as unknown as HTMLElement | null);

  const rx = Math.max(3, Math.min(16, rect.h * 0.1));
  const showLabel = rect.w > 52 && rect.h > 24;
  const fontSize = Math.min(11, rect.h * 0.36);
  const maxChars = Math.max(3, Math.floor(rect.w / (fontSize * 0.62)));
  const label =
    item.name.length > maxChars ? `${item.name.slice(0, maxChars - 1)}…` : item.name;

  return (
    <g
      ref={svgRef}
      data-cargo="1"
      {...listeners}
      {...attributes}
      style={{
        touchAction: "none",
        cursor: isDragging ? "grabbing" : "grab",
        opacity: isDragging ? 0.92 : 1,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(e.ctrlKey || e.metaKey || e.shiftKey);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onRotate();
      }}
      onContextMenu={onContextMenuOpen}
    >
      <title>{`${item.name} — ${placement.x}, ${placement.y}`}</title>
      {shape === "circle" ? (
        <circle
          cx={rect.x + rect.w / 2}
          cy={rect.y + rect.h / 2}
          r={Math.max(1, Math.min(rect.w, rect.h) / 2)}
          fill={item.color}
          fillOpacity={selected ? 0.95 : 0.76}
          stroke={selected ? "#ffffff" : "rgba(0,0,0,0.4)"}
          strokeWidth={selected ? 2.5 : 1.5}
          style={
            selected
              ? { filter: "drop-shadow(0 0 10px var(--glow-1))" }
              : isDragging
                ? { filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.5))" }
                : undefined
          }
        />
      ) : (
        <rect
          x={rect.x}
          y={rect.y}
          width={Math.max(1, rect.w)}
          height={Math.max(1, rect.h)}
          rx={rx}
          fill={item.color}
          fillOpacity={selected ? 0.95 : 0.76}
          stroke={selected ? "#ffffff" : "rgba(0,0,0,0.4)"}
          strokeWidth={selected ? 2.5 : 1.5}
          style={
            selected
              ? { filter: "drop-shadow(0 0 10px var(--glow-1))" }
              : isDragging
                ? { filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.5))" }
                : undefined
          }
        />
      )}
      {showLabel && (
        <text
          x={rect.x + rect.w / 2}
          y={rect.y + rect.h / 2 + fontSize * 0.36}
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight={600}
          fill="rgba(8, 5, 18, 0.78)"
          pointerEvents="none"
        >
          {label}
        </text>
      )}
      {/* подсветка примагниченного края при перетаскивании (ТЗ B1) */}
      {align && (
        <line
          x1={align.axis === "x" ? rect.x + (align.side === "end" ? rect.w : 0) : rect.x}
          y1={align.axis === "y" ? rect.y + (align.side === "end" ? rect.h : 0) : rect.y}
          x2={align.axis === "x" ? rect.x + (align.side === "end" ? rect.w : 0) : rect.x + rect.w}
          y2={align.axis === "y" ? rect.y + (align.side === "end" ? rect.h : 0) : rect.y + rect.h}
          stroke="var(--accent)"
          strokeWidth={3}
          strokeLinecap="round"
          pointerEvents="none"
          style={{ filter: "drop-shadow(0 0 4px var(--accent))" }}
        />
      )}
    </g>
  );
}

/* ----------------------------- маркер двери ----------------------------- */

function DoorMarker({
  side,
  ox,
  oy,
  bodyW,
  bodyH,
  label,
}: {
  side: "rear" | "right" | "left" | "top";
  ox: number;
  oy: number;
  bodyW: number;
  bodyH: number;
  label: string;
}) {
  if (side === "top") {
    return (
      <rect
        x={ox + 3}
        y={oy + 3}
        width={bodyW - 6}
        height={bodyH - 6}
        rx={12}
        fill="none"
        stroke="var(--accent)"
        strokeOpacity={0.6}
        strokeWidth={2}
        strokeDasharray="10 7"
        pointerEvents="none"
      >
        <title>{label}</title>
      </rect>
    );
  }

  const stroke = "var(--accent)";
  const width = 5;
  const common = { stroke, strokeWidth: width, strokeLinecap: "round" as const };

  if (side === "rear") {
    const cx = ox + bodyW;
    const y1 = oy + bodyH * 0.12;
    const y2 = oy + bodyH * 0.88;
    const cy = (y1 + y2) / 2;
    return (
      <g pointerEvents="none">
        <title>{label}</title>
        <line x1={cx} y1={y1} x2={cx} y2={y2} {...common} />
        <polygon
          points={`${cx + 5},${cy - 8} ${cx + 5},${cy + 8} ${cx + 16},${cy}`}
          fill={stroke}
        />
      </g>
    );
  }
  if (side === "left" || side === "right") {
    const cy = side === "left" ? oy : oy + bodyH;
    const x1 = ox + bodyW * 0.12;
    const x2 = ox + bodyW * 0.88;
    const cx = (x1 + x2) / 2;
    const dir = side === "left" ? -1 : 1;
    return (
      <g pointerEvents="none">
        <title>{label}</title>
        <line x1={x1} y1={cy} x2={x2} y2={cy} {...common} />
        <polygon
          points={`${cx - 8},${cy + dir * 5} ${cx + 8},${cy + dir * 5} ${cx},${cy + dir * 16}`}
          fill={stroke}
        />
      </g>
    );
  }
  return null;
}
