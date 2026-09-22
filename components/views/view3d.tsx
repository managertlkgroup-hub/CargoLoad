"use client";

import { CuboidIcon } from "lucide-react";

import { useT } from "@/hooks/use-t";

/** 3D-просмотр. Полноценная сцена (Three.js + InstancedMesh) — Группа 6. */
export default function View3D() {
  const t = useT();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="rounded-2xl bg-accent/12 p-4">
        <CuboidIcon className="size-8 text-accent" />
      </div>
      <p className="text-sm font-medium text-fg-2">{t("empty.3d.title")}</p>
      <p className="max-w-sm text-xs leading-relaxed text-muted">{t("empty.3d.text")}</p>
    </div>
  );
}
