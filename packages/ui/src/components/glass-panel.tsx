import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function GlassPanel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/40 backdrop-blur-xl",
        className,
      )}
      {...props}
    />
  );
}
