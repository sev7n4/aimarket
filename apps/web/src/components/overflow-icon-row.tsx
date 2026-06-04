"use client";

import { useRef, useState } from "react";
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
    "border-white/10 bg-black/[0.55] text-zinc-200 hover:border-white/20 hover:bg-white/[0.18] hover:text-white",
  orange:
    "border-orange-400/25 bg-black/[0.55] text-orange-200 hover:border-orange-300/45 hover:bg-orange-500/25 hover:text-orange-100",
  blue: "border-blue-400/25 bg-black/[0.55] text-blue-200 hover:border-blue-300/45 hover:bg-blue-500/25 hover:text-blue-100",
  red: "border-red-400/25 bg-black/[0.55] text-red-200 hover:border-red-300/45 hover:bg-red-500/25 hover:text-red-100",
  purple:
    "border-purple-400/25 bg-black/[0.55] text-purple-200 hover:border-purple-300/45 hover:bg-purple-500/25 hover:text-purple-100",
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
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full border shadow-[0_6px_18px_rgba(0,0,0,0.35)] backdrop-blur-md transition disabled:opacity-40 ${TONE_CLASS[action.tone ?? "default"]}`}
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
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    right: number;
    placement: "above" | "below";
  } | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
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
            ref={moreButtonRef}
            type="button"
            title="更多"
            className={`flex ${size === "sm" ? "size-6" : "size-7"} items-center justify-center rounded-full border border-white/10 bg-black/[0.55] text-zinc-200 shadow-[0_6px_18px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:border-white/20 hover:bg-white/[0.18] hover:text-white`}
            onClick={(e) => {
              e.stopPropagation();
              const rect = moreButtonRef.current?.getBoundingClientRect();
              if (rect) {
                const placement = rect.top < 140 ? "below" : "above";
                setMenuPosition({
                  top: placement === "below" ? rect.bottom + 6 : rect.top - 6,
                  right: window.innerWidth - rect.right,
                  placement,
                });
              }
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
              <div
                className="fixed z-50 min-w-[8rem] rounded-xl border border-white/10 bg-[#151515]/95 py-1 shadow-2xl backdrop-blur-xl"
                style={{
                  top: menuPosition?.top ?? 0,
                  right: menuPosition?.right ?? 0,
                  transform:
                    menuPosition?.placement === "above"
                      ? "translateY(-100%)"
                      : undefined,
                }}
              >
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
