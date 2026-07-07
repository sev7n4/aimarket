"use client";

import { Loader2 } from "lucide-react";

import { jobStatusLabel } from "@/lib/job-stream";

export type CreationPanelJobStatusBarProps = {
  jobStreamStatus: string | null;
  streamBusy: boolean;
  jobStatusSubtext: string | null;
  pollingJobId?: string | null;
  onCancelJob?: () => void;
};

export function CreationPanelJobStatusBar({
  jobStreamStatus,
  streamBusy,
  jobStatusSubtext,
  pollingJobId,
  onCancelJob,
}: CreationPanelJobStatusBarProps) {
  return (
    <div
      className={`mb-2 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
        jobStreamStatus === "failed"
          ? "border-red-500/30 bg-red-500/5 text-red-300"
          : "border-orange-500/20 bg-orange-500/5 text-orange-200/90"
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {streamBusy ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin" />
          ) : null}
          <span>{jobStatusLabel(jobStreamStatus)}</span>
        </div>
        {jobStatusSubtext ? (
          <p className="mt-0.5 text-[10px] text-zinc-500">{jobStatusSubtext}</p>
        ) : null}
      </div>
      {streamBusy && pollingJobId && onCancelJob ? (
        <button
          type="button"
          onClick={onCancelJob}
          className="rounded-md bg-white/10 px-2 py-1 text-xs text-zinc-300 transition hover:bg-white/20 hover:text-white"
          title="取消任务"
        >
          取消
        </button>
      ) : null}
    </div>
  );
}
