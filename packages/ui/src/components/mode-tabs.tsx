"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type CreationMode = "chat" | "quick" | "ecommerce";

export interface ModeTabItem {
  id: CreationMode;
  label: string;
  icon?: ReactNode;
  badge?: string;
}

export interface ModeTabsProps {
  items: ModeTabItem[];
  value: CreationMode;
  onChange: (mode: CreationMode) => void;
  className?: string;
}

export function ModeTabs({ items, value, onChange, className }: ModeTabsProps) {
  return (
    <div
      className={cn(
        "inline-flex rounded-2xl border border-white/10 bg-black/40 p-1",
        className,
      )}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
              active
                ? "bg-white text-black shadow"
                : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge ? (
              <span className="absolute -right-1 -top-2 rounded-full bg-purple-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
