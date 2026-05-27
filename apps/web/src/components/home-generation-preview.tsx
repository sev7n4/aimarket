"use client";

import { Loader2 } from "lucide-react";

/** P3-1 / P1-3：首页提交后、跳转 Studio 前的轻量过渡 */
export function HomeGenerationPreview({
  open,
  message = "正在打开创作页…",
}: {
  open: boolean;
  message?: string;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <Loader2 className="size-8 animate-spin text-orange-400" />
        <p className="text-sm font-medium text-zinc-100">{message}</p>
        <p className="text-xs text-zinc-500">生成进度将在画布上显示</p>
      </div>
    </div>
  );
}
