"use client";

import { Loader2 } from "lucide-react";
import { jobStatusLabel } from "@/lib/job-stream";

interface CanvasJobOverlayProps {
  status: string | null;
  failed?: boolean;
  onOpenChat?: () => void;
}

export function CanvasJobOverlay({
  status,
  failed,
  onOpenChat,
}: CanvasJobOverlayProps) {
  if (!status && !failed) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto mx-4 max-w-sm rounded-2xl border border-white/10 bg-[#141414]/95 px-5 py-4 shadow-2xl">
        {failed ? (
          <>
            <p className="text-sm font-medium text-red-300">生成失败</p>
            <p className="mt-1 text-xs text-zinc-500">
              请打开对话区查看详情或重试
            </p>
            {onOpenChat ? (
              <button
                type="button"
                onClick={onOpenChat}
                className="mt-3 rounded-full bg-white/10 px-4 py-1.5 text-xs text-zinc-200 hover:bg-white/15"
              >
                打开对话区
              </button>
            ) : null}
          </>
        ) : (
          <div className="flex items-center gap-3">
            <Loader2 className="size-5 shrink-0 animate-spin text-orange-400" />
            <div>
              <p className="text-sm font-medium text-zinc-100">
                {jobStatusLabel(status ?? "running")}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                完成后将自动定位到新图
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
