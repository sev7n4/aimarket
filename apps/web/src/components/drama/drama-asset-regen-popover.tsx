"use client";

import { useCallback, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";

type DramaAssetRegenPopoverProps = {
  open: boolean;
  title: string;
  placeholder?: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (instruction: string) => Promise<void>;
};

/** Seko 式：弹出卡片 + 提示词，调用 Studio 迭代能力重生成文本/图片 */
export function DramaAssetRegenPopover({
  open,
  title,
  placeholder = "描述你想如何修改…",
  busy,
  onClose,
  onSubmit,
}: DramaAssetRegenPopoverProps) {
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    const text = instruction.trim();
    if (!text || busy) return;
    setError(null);
    try {
      await onSubmit(text);
      setInstruction("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请重试");
    }
  }, [instruction, busy, onSubmit, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      data-testid="drama-asset-regen-popover"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-violet-500/20 bg-zinc-950 p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
            <Sparkles className="size-4 text-violet-400" />
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={4}
          placeholder={placeholder}
          disabled={busy}
          className="w-full resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 disabled:opacity-50"
          data-testid="drama-asset-regen-input"
        />
        {error ? (
          <p className="mt-2 text-xs text-red-400/90">{error}</p>
        ) : null}
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={busy || !instruction.trim()}
            onClick={() => void handleSubmit()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            data-testid="drama-asset-regen-submit"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
            重新生成
          </button>
        </div>
      </div>
    </div>
  );
}
