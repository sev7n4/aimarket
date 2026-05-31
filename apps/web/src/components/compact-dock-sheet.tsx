"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { MOBILE_BREAKPOINT } from "@/lib/breakpoints";

interface CompactDockSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  trigger: ReactNode;
  children: ReactNode;
  desktopWidthClass?: string;
  matchTriggerWidth?: boolean;
  placement?: "above" | "below";
  maxHeight?: string;
  /** 更紧凑的内边距与标题（质量/张数等小面板） */
  dense?: boolean;
  /** 桌面端宽度随内容收缩（不小于触发按钮宽度） */
  fitContent?: boolean;
}

function buildDesktopPos(
  rect: DOMRect,
  placement: "above" | "below",
  opts: { matchTriggerWidth: boolean; fitContent: boolean },
): { left: number; top?: number; bottom?: number; minWidth?: number } {
  const resolved =
    placement === "below" && rect.bottom + 280 > window.innerHeight - 16
      ? "above"
      : placement === "above" && rect.top < 280
        ? "below"
        : placement;
  const base =
    resolved === "below"
      ? { left: rect.left, top: rect.bottom + 8 }
      : { left: rect.left, bottom: window.innerHeight - rect.top + 8 };
  const minWidth =
    opts.matchTriggerWidth || opts.fitContent ? rect.width : undefined;
  return minWidth ? { ...base, minWidth } : base;
}

export function CompactDockSheet({
  open,
  onClose,
  title,
  trigger,
  children,
  desktopWidthClass = "w-56",
  matchTriggerWidth = false,
  placement = "above",
  maxHeight = "min(320px,50vh)",
  dense = false,
  fitContent = false,
}: CompactDockSheetProps) {
  const mobile = useIsMobile(MOBILE_BREAKPOINT);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [desktopPos, setDesktopPos] = useState<{ left: number; top?: number; bottom?: number; minWidth?: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !mobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, mobile]);

  useLayoutEffect(() => {
    if (!open || mobile || !anchorRef.current) {
      setDesktopPos(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    setDesktopPos(
      buildDesktopPos(rect, placement, { matchTriggerWidth, fitContent }),
    );
  }, [open, mobile, placement, matchTriggerWidth, fitContent]);

  useLayoutEffect(() => {
    if (!open || mobile || !desktopPos || !panelRef.current) return;
    const panelRect = panelRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const actualWidth = panelRect.width;
    const rightEdge = desktopPos.left + actualWidth;
    if (rightEdge > viewportWidth - 16) {
      const adjustedLeft = Math.max(16, viewportWidth - actualWidth - 16);
      setDesktopPos((prev) =>
        prev ? { ...prev, left: adjustedLeft } : prev,
      );
    }
  }, [open, mobile, desktopPos]);

  useEffect(() => {
    if (!open || mobile) return;
    function updatePos() {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      setDesktopPos(
        buildDesktopPos(rect, placement, { matchTriggerWidth, fitContent }),
      );
    }
    window.addEventListener("scroll", updatePos, true);
    return () => window.removeEventListener("scroll", updatePos, true);
  }, [open, mobile, placement, matchTriggerWidth, fitContent]);

  const panel = open ? (
    mobile ? (
      <div className="fixed inset-0 z-[200] flex flex-col justify-end">
        <button
          type="button"
          className="absolute inset-0 bg-black/60"
          aria-label="关闭"
          onClick={onClose}
        />
        <div
          className={`relative max-h-[min(50vh,380px)] overflow-y-auto rounded-t-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl ${
            dense
              ? "px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
              : "px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
          }`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20" />
          <div className={`flex items-center justify-between ${dense ? "mb-2" : "mb-3"}`}>
            <p className={`font-medium text-zinc-200 ${dense ? "text-xs" : "text-sm"}`}>
              {title}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/10"
              aria-label="关闭"
            >
              <X className="size-4" />
            </button>
          </div>
          {children}
        </div>
      </div>
    ) : desktopPos ? (
      <div
        ref={panelRef}
        style={{
          position: "fixed",
          left: desktopPos.left,
          ...(desktopPos.minWidth ? { minWidth: desktopPos.minWidth } : {}),
          ...(desktopPos.top != null
            ? { top: desktopPos.top }
            : { bottom: desktopPos.bottom }),
          maxHeight: maxHeight,
          zIndex: 200,
        }}
        className={`${
          fitContent
            ? "w-max max-w-[min(100vw-1.5rem,13rem)]"
            : desktopWidthClass
        } overflow-y-auto border border-white/10 bg-[#1a1a1a] shadow-xl ${
          dense ? "rounded-xl p-2" : "rounded-2xl p-3"
        }`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p
          className={`font-medium uppercase tracking-wider text-zinc-500 ${
            dense ? "mb-1.5 text-[9px]" : "mb-2 text-[10px]"
          }`}
        >
          {title}
        </p>
        {children}
      </div>
    ) : null
  ) : null;

  return (
    <div ref={anchorRef} className="relative shrink-0">
      {trigger}
      {panel && typeof document !== "undefined"
        ? createPortal(panel, document.body)
        : panel}
    </div>
  );
}
