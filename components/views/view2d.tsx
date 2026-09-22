"use client";

import { motion } from "framer-motion";
import { LayoutGrid } from "lucide-react";

import { useT } from "@/hooks/use-t";
import { useVehicle } from "@/hooks/use-vehicle";
import { dimsFor } from "@/lib/geometry";
import { useLayoutStore } from "@/store/use-layout-store";

const PAD = 46;

/** Вид сверху: кузов + грузы. Drag-and-drop, слои и snap — Группа 5. */
export default function View2D() {
  const t = useT();
  const vehicle = useVehicle();
  const items = useLayoutStore((s) => s.items);
  const placements = useLayoutStore((s) => s.placements);
  const selectedIds = useLayoutStore((s) => s.selectedIds);
  const select = useLayoutStore((s) => s.select);

  const L = vehicle.innerLength;
  const W = vehicle.innerWidth;
  const vbW = L + PAD * 2;
  const vbH = W + PAD * 2;

  const itemById = new Map(items.map((i) => [i.id, i]));

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="rounded-2xl bg-primary/12 p-4">
          <LayoutGrid className="size-8 text-primary" />
        </div>
        <p className="text-sm font-medium text-fg-2">{t("empty.2d.title")}</p>
        <p className="max-w-sm text-xs leading-relaxed text-muted">{t("empty.2d.text")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 p-2">
        <svg
          viewBox={`0 0 ${vbW} ${vbH}`}
          className="h-full w-full"
          role="img"
          aria-label={t("view.2d")}
        >
          <defs>
            <linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* кузов */}
          <g transform={`translate(${PAD}, ${PAD})`}>
            <rect
              width={L}
              height={W}
              rx={Math.min(40, W * 0.03)}
              fill="url(#bodyGrad)"
              stroke="var(--border-strong)"
              strokeWidth={3}
            />
            {/* грузы */}
            {placements.map((p) => {
              const item = itemById.get(p.itemId);
              if (!item) return null;
              const d = dimsFor(item, p.yaw, p.axis);
              const selected = selectedIds.includes(item.id);
              return (
                <g key={p.id} onClick={(e) => select(item.id, e.ctrlKey || e.metaKey || e.shiftKey)} style={{ cursor: "pointer" }}>
                  <motion.rect
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    x={p.x}
                    y={p.y}
                    width={d.dx}
                    height={d.dy}
                    rx={Math.min(24, d.dy * 0.06)}
                    fill={item.color}
                    fillOpacity={selected ? 0.95 : 0.78}
                    stroke={selected ? "#fff" : "rgba(0,0,0,0.35)"}
                    strokeWidth={selected ? 5 : 2}
                  />
                </g>
              );
            })}
          </g>

          {/* подписи размеров кузова */}
          <g fill="var(--muted)" fontSize={Math.max(16, L / 90)} fontFamily="Inter, sans-serif">
            <text x={vbW / 2} y={PAD / 2 + 6} textAnchor="middle" className="tnum">
              {L} мм
            </text>
            <text
              x={PAD / 2 - 4}
              y={vbH / 2}
              textAnchor="middle"
              transform={`rotate(-90 ${PAD / 2 - 4} ${vbH / 2})`}
              className="tnum"
            >
              {W} мм
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
