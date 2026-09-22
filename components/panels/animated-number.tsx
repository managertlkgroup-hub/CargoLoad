"use client";

import { animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/**
 * Анимированный счётчик: плавно доезжает до ЦЕЛЕВОГО (уже округлённого) значения,
 * поэтому финальный текст всегда равен ровному числу метрик.
 */
export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: (v: number) => string;
  className?: string;
}) {
  const from = useRef(value);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const controls = animate(from.current, value, {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    });
    from.current = value;
    return () => controls.stop();
  }, [value]);

  return <span className={className}>{format(display)}</span>;
}