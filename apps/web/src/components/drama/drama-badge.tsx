import type { ReactNode } from "react";

export function DramaBadge({
  children,
  color,
}: {
  children: ReactNode;
  color: string;
}) {
  return (
    <span
      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
      style={{ background: `${color}22`, color }}
    >
      {children}
    </span>
  );
}
