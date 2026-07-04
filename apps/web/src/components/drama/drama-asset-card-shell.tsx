"use client";

import type { ReactNode } from "react";

import { cn } from "@aimarket/ui";

import {
  DRAMA_CATEGORY_THEME,
  type DramaAssetCategory,
} from "./drama-asset-card-theme";

type DramaAssetCardShellProps = {
  category: DramaAssetCategory;
  hero?: ReactNode;
  heroAspect?: "portrait" | "landscape" | "square";
  badges?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  testId?: string;
  /** 画布节点内更紧凑的间距 */
  compact?: boolean;
};

export function DramaAssetCardShell({
  category,
  hero,
  heroAspect = "landscape",
  badges,
  footer,
  children,
  className,
  testId,
  compact = false,
}: DramaAssetCardShellProps) {
  const theme = DRAMA_CATEGORY_THEME[category];
  const Icon = theme.icon;
  const aspectClass =
    heroAspect === "portrait"
      ? "aspect-[3/4]"
      : heroAspect === "square"
        ? "aspect-square"
        : "aspect-video";

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-[inherit]",
        className,
      )}
      data-testid={testId ?? `drama-asset-card-${category}`}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-2 border-b",
          compact ? "px-2.5 py-1.5" : "px-3 py-2",
        )}
        style={{
          background: theme.accentSoft,
          borderColor: theme.accentBorder,
        }}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-md"
            style={{ background: `${theme.accent}33`, color: theme.accent }}
          >
            <Icon className={compact ? "size-3" : "size-3.5"} />
          </span>
          <span
            className={cn(
              "font-semibold tracking-wide",
              compact ? "text-[10px]" : "text-[11px]",
            )}
            style={{ color: theme.accent }}
          >
            {theme.label}
          </span>
        </div>
        {badges ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            {badges}
          </div>
        ) : null}
      </div>

      {hero ? (
        <div
          className={cn(
            "relative w-full shrink-0 overflow-hidden",
            aspectClass,
          )}
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          {hero}
        </div>
      ) : null}

      {children ? (
        <div
          className={cn(
            "min-h-0 flex-1",
            compact ? "space-y-1.5 p-2.5" : "space-y-2 p-3",
          )}
        >
          {children}
        </div>
      ) : null}

      {footer ? (
        <div
          className={cn(
            "shrink-0 border-t border-white/5",
            compact ? "px-2.5 py-1.5" : "px-3 py-2",
          )}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}
