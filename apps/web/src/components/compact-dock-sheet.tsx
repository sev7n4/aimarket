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
}: CompactDockSheetProps) {
  const mobile = useIsMobile(MOBILE_BREAKPOINT);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [desktopPos, setDesktopPos] = useState<{ left: number; top?: number; bottom?: number; width?: number } | null>(null);

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
    const base = placement === "below"
      ? { left: rect.left, top: rect.bottom + 8 }
      : { left: rect.left, bottom: window.innerHeight - rect.top + 8 };
    setDesktopPos(
      matchTriggerWidth ? { ...base, width: rect.width } : base,
    );
  }, [open, mobile, placement, matchTriggerWidth]);

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
          className="relative max-h-[min(50vh,380px)] overflow-y-auto rounded-t-2xl border border-white/10 bg-[#1a1a1a] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20" />
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-200">{title}</p>
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
        style={{
          position: "fixed",
          left: desktopPos.left,
          ...(desktopPos.width ? { width: desktopPos.width } : {}),
          ...(placement === "below" ? { top: desktopPos.top } : { bottom: desktopPos.bottom }),
          maxHeight: maxHeight,
          zIndex: 120,
        }}
        className={`${desktopPos.width ? "" : desktopWidthClass} overflow-y-auto rounded-2xl border border-white/10 bg-[#1a1a1a] p-3 shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
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
