import { cn } from "@/lib/utils";
import Image from "next/image";

export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <Image
        src="/icons/logo.svg"
        alt=""
        width={size}
        height={size}
        className="shrink-0 drop-shadow-[0_4px_12px_var(--glow-1)]"
        priority
      />
      <span className="text-[15px] font-semibold tracking-tight text-fg">
        Cargo
        <span className="bg-gradient-to-r from-primary via-[#a78bfa] to-accent bg-clip-text text-transparent">
          Planner
        </span>
      </span>
    </span>
  );
}
