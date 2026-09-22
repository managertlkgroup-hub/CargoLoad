"use client";

import { motion } from "framer-motion";
import { Boxes, Plus, Sparkles, Warehouse } from "lucide-react";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Каркас интерфейса (Группа 1).
 * Демонстрирует дизайн-систему Obsidian Aurora: стеклянные панели,
 * каскадное появление, пульс-SKELLETON'ы, пустые состояния с CTA.
 * В Группе 4 наполняется реальным контентом.
 */
export function AppShell() {
  const cascade = {
    hidden: { opacity: 0, y: 14 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 0.08 * i, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
    }),
  };

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Верхняя панель */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="glass sticky top-0 z-40 m-3 mb-0 rounded-2xl px-4 py-2.5"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Logo />
            <Badge variant="accent">beta</Badge>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <span className="panel-label">Планировщик загрузки кузова</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Sparkles className="size-3.5" />
              Сессии
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </motion.header>

      {/* Рабочая область: три панели */}
      <main className="grid flex-1 gap-3 p-3 lg:grid-cols-[300px_1fr_320px]">
        {/* Левая панель — грузы */}
        <motion.aside
          custom={0}
          variants={cascade}
          initial="hidden"
          animate="show"
          className="glass flex min-h-[220px] flex-col rounded-2xl p-4 lg:min-h-0"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="panel-label">Грузы</span>
            <Button size="icon-sm" variant="ghost" aria-label="Добавить груз">
              <Plus className="size-4" />
            </Button>
          </div>
          <EmptyState
            icon={Boxes}
            title="Кузов пуст"
            text="Добавьте грузы вручную или выберите готовый пресет — раскладка появится мгновенно."
            action="Добавить груз"
          />
        </motion.aside>

        {/* Центр — 2D/3D вид */}
        <motion.section
          custom={1}
          variants={cascade}
          initial="hidden"
          animate="show"
          className="glass flex min-h-[340px] flex-col rounded-2xl p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="panel-label">Вид кузова</span>
            <Badge variant="muted">2D / 3D</Badge>
          </div>
          <div className="flex-1 rounded-xl border border-dashed border-border-strong/70 bg-panel-soft/50 p-6">
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="rounded-2xl bg-primary/15 p-4">
                <Warehouse className="size-8 text-primary" />
              </div>
              <p className="max-w-sm text-sm text-muted">
                Выберите автомобиль и добавьте грузы — здесь появится интерактивная раскладка с
                drag-and-drop и 3D-просмотром.
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        </motion.section>

        {/* Правая панель — метрики */}
        <motion.aside
          custom={2}
          variants={cascade}
          initial="hidden"
          animate="show"
          className="glass flex min-h-[220px] flex-col gap-4 rounded-2xl p-4 lg:min-h-0"
        >
          <span className="panel-label">Метрики</span>
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-panel-soft/60 p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-muted">
                <span>Объём</span>
                <span className="tnum text-fg-2">0 %</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-panel-soft">
                <div className="h-full w-0 rounded-full bg-gradient-to-r from-primary to-accent" />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-panel-soft/60 p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-muted">
                <span>Вес</span>
                <span className="tnum text-fg-2">0 %</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-panel-soft">
                <div className="h-full w-0 rounded-full bg-gradient-to-r from-accent to-primary" />
              </div>
            </div>
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        </motion.aside>
      </main>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
  action: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.35, duration: 0.4 }}
      className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong/70 p-5 text-center"
    >
      <div className="rounded-2xl bg-accent/12 p-3.5">
        <Icon className="size-6 text-accent" />
      </div>
      <p className="text-sm font-medium text-fg-2">{title}</p>
      <p className="text-xs leading-relaxed text-muted">{text}</p>
      <Button size="sm" className="mt-1">
        {action}
      </Button>
    </motion.div>
  );
}
