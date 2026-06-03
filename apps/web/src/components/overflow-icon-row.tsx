"use client";

import { useState } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

export interface OverflowIconAction {
  id: string;
  icon: LucideIcon;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  spinning?: boolean;
  tone?: "default" | "orange" | "blue" | "red" | "purple";
}

const TONE_CLASS: Record<NonNullable<OverflowIconAction["tone"]>, string> = {
  default:
    "bg-white/10 text-zinc-300 hover:bg-white/20 hover:text-white",
  orange:
    "bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 hover:text-orange-100",
  blue: "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 hover:text-blue-100",
  red: "bg-red-500/20 text-red-300 hover:bg-red-500/30 hover:text-red-100",
  purple:
    "bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 hover:text-purple-100",
};

function IconButton({
  action,
  size = "md",
}: {
  action: OverflowIconAction;
  size?: "sm" | "md";
}) {
  const Icon = action.icon;
  const dim = size === "sm" ? "size-6" : "size-7";
  const iconDim = size === "sm" ? "size-3" : "size-3.5";
  return (
    <button
      type="button"
      data-testid={action.id.startsWith("canvas-") ? action.id : undefined}
      title={action.title}
      disabled={action.disabled}
      onClick={(e) => {
        e.stopPropagation();
        action.onClick();
      }}
      className={`flex ${dim} shrink-0 items-center justify-center rounded-md transition disabled:opacity-40 ${TONE_CLASS[action.tone ?? "default"]}`}
    >
      <Icon
        className={`${iconDim} ${action.spinning ? "animate-spin" : ""}`}
        strokeWidth={1.75}
      />
    </button>
  );
}

interface OverflowIconRowProps {
  actions: OverflowIconAction[];
  maxVisible?: number;
  size?: "sm" | "md";
  align?: "start" | "center" | "end";
  className?: string;
}

export function OverflowIconRow({
  actions,
  maxVisible = 5,
  size = "md",
  align = "center",
  className = "",
}: OverflowIconRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const visible = actions.slice(0, maxVisible);
  const overflow = actions.slice(maxVisible);

  const justify =
    align === "start"
      ? "justify-start"
      : align === "end"
        ? "justify-end"
        : "justify-center";

  return (
    <div
      className={`relative flex items-center gap-0.5 ${justify} ${className}`.trim()}
      onClick={(e) => e.stopPropagation()}
    >
      {visible.map((action) => (
        <IconButton key={action.id} action={action} size={size} />
      ))}
      {overflow.length > 0 ? (
        <div className="relative">
          <button
            type="button"
            title="更多"
            className={`flex ${size === "sm" ? "size-6" : "size-7"} items-center justify-center rounded-md bg-white/10 text-zinc-300 transition hover:bg-white/20 hover:text-white`}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
          >
            <MoreHorizontal className={size === "sm" ? "size-3" : "size-3.5"} />
          </button>
          {menuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                aria-label="关闭菜单"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute bottom-full right-0 z-50 mb-1 min-w-[8rem] rounded-lg border border-white/10 bg-[#1a1a1a]/95 py-1 shadow-xl backdrop-blur-sm">
                {overflow.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      disabled={action.disabled}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-200 transition hover:bg-white/10 disabled:opacity-40"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        action.onClick();
                      }}
                    >
                      <Icon className="size-3.5 shrink-0 text-zinc-400" />
                      <span>{action.title}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
