"use client";

import { Loader2 } from "lucide-react";
import { jobStatusLabel } from "@/lib/job-stream";

interface CanvasJobOverlayProps {
  status: string | null;
  failed?: boolean;
  onOpenChat?: () => void;
  /** 套图渐进：已完成张数 */
  completed?: number;
  /** 套图渐进：总张数 */
  total?: number;
}

export function CanvasJobOverlay({
  status,
  failed,
  onOpenChat,
  completed = 0,
  total = 0,
}: CanvasJobOverlayProps) {
  if (!status && !failed) return null;

  const progressive = total > 1 && status === "running" && completed > 0;
  const showCorner = progressive;

  if (showCorner) {
    return (
      <div
        className="pointer-events-none absolute bottom-4 right-4 z-30"
        role="status"
        aria-live="polite"
      >
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-[#141414]/95 px-4 py-2 shadow-xl">
          <Loader2 className="size-4 shrink-0 animate-spin text-orange-400" />
          <span className="text-xs text-zinc-200">
            套图生成 {completed}/{total}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-30 flex items-center justify-center ${
        progressive ? "bg-transparent" : "bg-black/40 backdrop-blur-[2px]"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto mx-4 max-w-sm rounded-2xl border border-white/10 bg-[#141414]/95 px-5 py-4 shadow-2xl">
        {failed ?
          <>
            <p className="text-sm font-medium text-red-300">生成失败</p>
            <p className="mt-1 text-xs text-zinc-500">
              请打开对话区查看详情或重试
            </p>
            {onOpenChat ?
              <button
                type="button"
                onClick={onOpenChat}
                className="mt-3 rounded-full bg-white/10 px-4 py-1.5 text-xs text-zinc-200 hover:bg-white/15"
              >
                打开对话区
              </button>
            : null}
          </>
        : <div className="flex items-center gap-3">
            <Loader2 className="size-5 shrink-0 animate-spin text-orange-400" />
            <div>
              <p className="text-sm font-medium text-zinc-100">
                {total > 1 && completed > 0
                  ? `套图生成中 ${completed}/${total}`
                  : jobStatusLabel(status ?? "running")}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {total > 1
                  ? "新图将逐张落在画布上"
                  : "完成后将自动定位到新图"}
              </p>
            </div>
          </div>
        }
      </div>
    </div>
  );
}
