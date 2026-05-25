"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { GlassPanel, Button } from "@aimarket/ui";
import { submitContentReport } from "@/lib/api-client";

interface ContentReportDialogProps {
  sessionId: string;
  jobId?: string | null;
}

export function ContentReportDialog({ sessionId, jobId }: ContentReportDialogProps) {
  const [open, setOpen] = useState(false);
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
      setOpen(false);
      alert("已提交举报，我们会尽快审核");
    } catch (err) {
      alert(err instanceof Error ? err.message : "提交失败");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] text-zinc-600 underline-offset-2 hover:text-zinc-400 hover:underline"
      >
        <Flag className="mr-0.5 inline size-3" />
        举报违规内容
      </button>
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
            onClick={() => setOpen(false)}
            className="text-xs text-zinc-500"
          >
            取消
          </button>
        </div>
      </form>
    </GlassPanel>
  );
}
