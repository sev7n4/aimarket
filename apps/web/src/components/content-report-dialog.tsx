"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { GlassPanel, Button } from "@aimarket/ui";
import { submitContentReport } from "@/lib/api-client";

interface ContentReportDialogProps {
  sessionId: string;
  jobId?: string | null;
  /**
   * 受控 open（推荐由父组件传入，配合 StudioHeader 右上 Flag 图标统一触发）。
   * 不传则保留旧的「内联触发按钮 + 自管开关」兼容行为。
   */
  open?: boolean;
  onClose?: () => void;
}

export function ContentReportDialog({
  sessionId,
  jobId,
  open: controlledOpen,
  onClose,
}: ContentReportDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const close = () => {
    if (isControlled) onClose?.();
    else setInternalOpen(false);
  };

  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 5) return;
    setPending(true);
    try {
      await submitContentReport({
        sessionId,
        jobId: jobId ?? undefined,
        reason: reason.trim(),
      });
      setReason("");
      close();
      alert("已提交举报，我们会尽快审核");
    } catch (err) {
      alert(err instanceof Error ? err.message : "提交失败");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    if (isControlled) return null;
    return (
      <button
        type="button"
        onClick={() => setInternalOpen(true)}
        className="text-[10px] text-zinc-600 underline-offset-2 hover:text-zinc-400 hover:underline"
      >
        <Flag className="mr-0.5 inline size-3" />
        举报违规内容
      </button>
    );
  }

  if (isControlled) {
    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4"
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <GlassPanel className="w-full max-w-sm p-4">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
            <div className="flex items-center gap-2">
              <Flag className="size-4 text-amber-400" />
              <p className="text-sm font-medium text-zinc-200">
                举报 AI 生成内容
              </p>
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="请描述违规原因（至少 5 字）"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none focus:border-orange-500/40"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-lg px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300"
              >
                取消
              </button>
              <Button
                type="submit"
                variant="primary"
                className="text-xs"
                disabled={pending || reason.trim().length < 5}
              >
                {pending ? "提交中…" : "提交"}
              </Button>
            </div>
          </form>
        </GlassPanel>
      </div>
    );
  }

  return (
    <GlassPanel className="mt-2 p-3">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-2">
        <p className="text-xs font-medium text-zinc-300">举报 AI 生成内容</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="请描述违规原因（至少 5 字）"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs outline-none"
        />
        <div className="flex gap-2">
          <Button
            type="submit"
            variant="primary"
            className="text-xs"
            disabled={pending || reason.trim().length < 5}
          >
            {pending ? "提交中…" : "提交"}
          </Button>
          <button
            type="button"
            onClick={close}
            className="text-xs text-zinc-500"
          >
            取消
          </button>
        </div>
      </form>
    </GlassPanel>
  );
}
