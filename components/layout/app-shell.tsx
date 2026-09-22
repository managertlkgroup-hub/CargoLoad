"use client";

import { AnimatePresence, motion } from "framer-motion";

import { useHotkeys } from "@/hooks/use-hotkeys";
import { usePackEngine } from "@/hooks/use-pack-engine";
import { StoreHydrator } from "@/components/store-hydrator";
import { Dialogs } from "@/components/dialogs";
import { TopBar } from "@/components/layout/top-bar";
import { LeftPanel } from "@/components/layout/left-panel";
import { RightPanel } from "@/components/layout/right-panel";
import { ViewHost } from "@/components/views/view-host";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useUiStore } from "@/store/use-ui-store";

/**
 * Главная оболочка: три стеклянные панели (на планшете/телефоне —
 * выдвижные шторки), горячие клавиши, авто-пересчёт раскладки в Web Worker.
 */
export function AppShell() {
  useHotkeys();
  usePackEngine();

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const leftOpen = useUiStore((s) => s.leftPanelOpen);
  const rightOpen = useUiStore((s) => s.rightPanelOpen);
  const setLeft = useUiStore((s) => s.setLeftPanel);
  const setRight = useUiStore((s) => s.setRightPanel);

  return (
    <div className="flex min-h-dvh flex-col">
      <StoreHydrator />
      <TopBar />
      <Dialogs />

      <main className="relative flex min-h-0 flex-1 gap-3 p-3">
        {/* десктопные колонки (на мобильных — выдвижные шторки ниже) */}
        {leftOpen && (
          <motion.div
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="hidden min-h-0 lg:block"
          >
            <LeftPanel />
          </motion.div>
        )}

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="glass relative min-h-[440px] min-w-0 flex-1 overflow-hidden rounded-2xl lg:min-h-0"
        >
          <ViewHost />
        </motion.section>

        {rightOpen && (
          <motion.div
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="hidden min-h-0 lg:block"
          >
            <RightPanel />
          </motion.div>
        )}
      </main>

      {/* мобильные шторки (только на узких экранах) */}
      <AnimatePresence>
        {leftOpen && !isDesktop && (
          <motion.div
            key="left-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLeft(false)}
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]"
          />
        )}
        {leftOpen && !isDesktop && (
          <motion.div
            key="left-drawer"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="fixed inset-y-2 left-2 z-50 w-[86vw] max-w-[340px]"
          >
            <LeftPanel onClose={() => setLeft(false)} />
          </motion.div>
        )}
        {rightOpen && !isDesktop && (
          <motion.div
            key="right-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setRight(false)}
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]"
          />
        )}
        {rightOpen && !isDesktop && (
          <motion.div
            key="right-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="fixed inset-y-2 right-2 z-50 w-[86vw] max-w-[340px]"
          >
            <RightPanel onClose={() => setRight(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
