"use client";

import { useRouter } from "next/navigation";
import { Sparkles, Plus, Wand2 } from "lucide-react";
import { buildStudioUrl } from "@/lib/studio-navigation";

interface StartCreateDialogProps {
  open: boolean;
  onClose: () => void;
}

export function StartCreateDialog({ open, onClose }: StartCreateDialogProps) {
  const router = useRouter();

  function handleCreateNew() {
    router.push(buildStudioUrl("canvas"));
    onClose();
  }

  function handleFromInspiration() {
    router.push("/inspiration");
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0b0b] p-6 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-full bg-gradient-to-r from-orange-500 to-orange-400 p-2">
            <Sparkles className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">开始创作</h2>
            <p className="text-xs text-zinc-500">选择创作方式</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleCreateNew}
            className="w-full flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-orange-500/30 hover:bg-orange-500/10"
          >
            <Plus className="size-5 text-orange-400" />
            <div>
              <p className="text-sm font-medium text-white">创建新画布</p>
              <p className="text-xs text-zinc-500">从空白画布开始创作</p>
            </div>
          </button>

          <button
            type="button"
            onClick={handleFromInspiration}
            className="w-full flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-orange-500/30 hover:bg-orange-500/10"
          >
            <Wand2 className="size-5 text-purple-400" />
            <div>
              <p className="text-sm font-medium text-white">从模板/灵感开始</p>
              <p className="text-xs text-zinc-500">选择灵感套图快速复刻</p>
            </div>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
        >
          取消
        </button>
      </div>
    </div>
  );
}