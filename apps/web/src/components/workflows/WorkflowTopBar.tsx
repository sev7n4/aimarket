"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import { SessionTitleActions } from "@/components/session-title-actions";
import { WorkflowShareButton } from "@/components/workflows/WorkflowShareButton";
import {
  dispatchWorkflowRunAll,
  WORKFLOW_RUN_ALL_PROGRESS_EVENT,
  WORKFLOW_TOAST_EVENT,
  type WorkflowRunAllProgress,
} from "@/components/workflows/WorkflowToolNodeContent";

type WorkflowTopBarProps = {
  sessionId?: string;
  sessionTitle: string;
  readOnly?: boolean;
  layoutSaving?: boolean;
  onTitleSaved?: (title: string) => void;
};

export function WorkflowTopBar({
  sessionId,
  sessionTitle,
  readOnly = false,
  layoutSaving = false,
  onTitleSaved,
}: WorkflowTopBarProps) {
  const [runProgress, setRunProgress] = useState<WorkflowRunAllProgress | null>(
    null,
  );
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const onProgress = (event: Event) => {
      const detail = (event as CustomEvent<{ progress?: WorkflowRunAllProgress | null }>)
        .detail;
      setRunProgress(detail?.progress ?? null);
    };
    const onToast = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message;
      if (!message) return;
      setToast(message);
      window.setTimeout(() => setToast(null), 3200);
    };
    document.addEventListener(WORKFLOW_RUN_ALL_PROGRESS_EVENT, onProgress);
    document.addEventListener(WORKFLOW_TOAST_EVENT, onToast);
    return () => {
      document.removeEventListener(WORKFLOW_RUN_ALL_PROGRESS_EVENT, onProgress);
      document.removeEventListener(WORKFLOW_TOAST_EVENT, onToast);
    };
  }, []);

  const running = runProgress !== null;

  return (
    <>
      <header
        className="relative flex h-10 shrink-0 items-center justify-between border-b border-white/[0.03] bg-[#030303]/80 px-3 md:px-4"
        data-testid="workflow-top-bar"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/workflows"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
            aria-label="返回工作流列表"
            title="返回工作流列表"
            data-testid="workflow-back"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            {sessionId ? (
              <SessionTitleActions
                sessionId={sessionId}
                title={sessionTitle}
                variant="header"
                disabled={readOnly}
                onTitleSaved={onTitleSaved}
              />
            ) : (
              <p className="truncate text-sm font-medium text-zinc-300">
                {sessionTitle}
              </p>
            )}
          </div>
        </div>

        <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 text-xs text-zinc-500 sm:block">
          {running ? (
            <span className="text-violet-300">
              运行中 {runProgress.current}/{runProgress.total}
            </span>
          ) : layoutSaving ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="size-3 animate-spin" />
              保存中…
            </span>
          ) : (
            <span>已保存</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 sm:hidden">
            {running
              ? `运行中 ${runProgress.current}/${runProgress.total}`
              : layoutSaving
                ? "保存中…"
                : "已保存"}
          </span>
          <button
            type="button"
            disabled={readOnly || running}
            onClick={() => dispatchWorkflowRunAll()}
            className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
            data-testid="workflow-run-all"
          >
            {running ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            全部运行
          </button>
          <WorkflowShareButton sessionId={sessionId} variant="toolbar" />
        </div>
      </header>
      {toast ? (
        <div
          className="pointer-events-none fixed left-1/2 top-14 z-50 -translate-x-1/2 rounded-lg border border-white/10 bg-zinc-900/95 px-4 py-2 text-sm text-zinc-100 shadow-lg"
          data-testid="workflow-toast"
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}
