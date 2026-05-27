"use client";

import { useEffect, useRef, type ReactNode } from "react";
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
  /** 桌面端弹层宽度 */
  desktopWidthClass?: string;
}

/** 工作台底部控件：移动端底部抽屉，桌面端紧凑上弹层 */
export function CompactDockSheet({
  open,
  onClose,
  title,
  trigger,
  children,
  desktopWidthClass = "w-56",
}: CompactDockSheetProps) {
  const mobile = useIsMobile(MOBILE_BREAKPOINT);
  const anchorRef = useRef<HTMLDivElement>(null);

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
            >
              <X className="size-4" />
            </button>
          </div>
          {children}
        </div>
      </div>
    ) : (
      <div
        className={`absolute bottom-full left-0 z-[120] mb-2 ${desktopWidthClass} max-h-[min(320px,50vh)] overflow-y-auto rounded-2xl border border-white/10 bg-[#1a1a1a] p-3 shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          {title}
        </p>
        {children}
      </div>
    )
  ) : null;

  return (
    <div ref={anchorRef} className="relative shrink-0">
      {trigger}
      {panel && mobile
        ? typeof document !== "undefined"
          ? createPortal(panel, document.body)
          : panel
        : panel}
    </div>
  );
}
