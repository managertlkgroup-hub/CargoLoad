"use client";

import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";

import { useUiStore } from "@/store/use-ui-store";

const View2D = dynamic(() => import("@/components/views/view2d"), { ssr: false });
const View3D = dynamic(() => import("@/components/views/view3d"), { ssr: false });

/** Переключение 2D/3D с плавным кроссфейдом. */
export function ViewHost() {
  const viewMode = useUiStore((s) => s.viewMode);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={viewMode}
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.01 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0"
      >
        {viewMode === "2d" ? <View2D /> : <View3D />}
      </motion.div>
    </AnimatePresence>
  );
}
