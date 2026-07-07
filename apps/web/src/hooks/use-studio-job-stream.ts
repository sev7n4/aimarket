"use client";

import { useCallback, useEffect, useRef, useState, type RefObject, type Dispatch, type SetStateAction, type MutableRefObject } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { DesignCanvasHandle } from "@/components/design-canvas";
import {
  cancelJob,
  fetchJob,
  listSessions,
} from "@/lib/api-client";
import type { PendingBatchLineage } from "@/lib/canvas-tools";
import type { CreationMode } from "@aimarket/ui";
import type { ImageSession } from "@/lib/types";
import { formatJobErrorMessage } from "@/lib/job-error-message";
import { invalidateSessionCanvasBundle } from "@/hooks/use-session-canvas";
import {
  watchJob,
  JOB_STREAM_DISCONNECTED_HINT,
  JOB_STREAM_STILL_RUNNING_HINT,
} from "@/lib/job-stream";
import { isToolGridToolId } from "@/lib/tool-grid-labels";
import type { ToolGridResultState } from "@/components/tool-grid-result-panel";
import { formatToolProviderLabel } from "@/lib/studio-tool-meta";
import { trackEvent } from "@/lib/api-client";

const STUDIO_SIDEBAR_SESSION_LIMIT = 200;

export type UseStudioJobStreamOptions = {
  user: unknown;
  sessionId: string;
  mode: CreationMode;
  router: AppRouterInstance;
  studioPrompt: string;
  activeWorkspaceId: string | null;
  initialJobId?: string;
  canvasRef: RefObject<DesignCanvasHandle | null>;
  canvasItemsRef: RefObject<import("@/lib/canvas-tools").CanvasItem[]>;
  loadCanvas: (opts?: { force?: boolean }) => Promise<void>;
  loadCanvasRef: MutableRefObject<
    (opts?: { force?: boolean }) => Promise<void>
  >;
  refreshUser: () => Promise<void>;
  registerBatchLineage: (jobId: string, lineage: PendingBatchLineage) => void;
  setSessions: Dispatch<SetStateAction<ImageSession[]>>;
  setSelectedCanvasId: Dispatch<SetStateAction<string | null>>;
  setSelectSourceBanner: Dispatch<SetStateAction<string | null>>;
  setToolGridResult: Dispatch<SetStateAction<ToolGridResultState | null>>;
  scrollToLatestCanvasBatch: () => void;
};

export function useStudioJobStream({
  user,
  sessionId,
  mode,
  router,
  studioPrompt,
  activeWorkspaceId,
  initialJobId,
  canvasRef,
  canvasItemsRef,
  loadCanvas,
  loadCanvasRef,
  refreshUser,
  registerBatchLineage,
  setSessions,
  setSelectedCanvasId,
  setSelectSourceBanner,
  setToolGridResult,
  scrollToLatestCanvasBatch,
}: UseStudioJobStreamOptions) {
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [jobWatchSeq, setJobWatchSeq] = useState(0);
  const [jobStreamStatus, setJobStreamStatus] = useState<string | null>(null);
  const [jobProgressCompleted, setJobProgressCompleted] = useState(0);
  const [jobProgressTotal, setJobProgressTotal] = useState(0);
  const [jobStartedAt, setJobStartedAt] = useState<number | null>(null);
  const [queueAhead, setQueueAhead] = useState<number | null>(null);
  const [activeJobPrompt, setActiveJobPrompt] = useState<string | null>(null);
  const [jobFailed, setJobFailed] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobFailedToolType, setJobFailedToolType] = useState<string | null>(
    null,
  );
  const [, setJobTick] = useState(0);

  const lastOutputCountRef = useRef(0);
  const completingJobIdRef = useRef<string | null>(null);
  const handleJobCompleteRef = useRef<
    (completedJobId?: string) => Promise<void>
  >(async () => {});

  const dismissJobFailure = useCallback(() => {
    setJobFailed(false);
    setJobError(null);
    setJobFailedToolType(null);
    setSelectSourceBanner(null);
  }, [setSelectSourceBanner]);

  const handleJobComplete = useCallback(
    async (completedJobId?: string) => {
      if (completedJobId && completingJobIdRef.current === completedJobId) {
        return;
      }
      if (completedJobId) completingJobIdRef.current = completedJobId;
      try {
        invalidateSessionCanvasBundle(sessionId);
        let jobStatus: string | undefined;
        let toolType: string | undefined;
        let failedJobError: string | null = null;
        let failedPointsCost = 0;
        let completedJob: Awaited<ReturnType<typeof fetchJob>> | undefined;
        if (completedJobId) {
          try {
            const job = await fetchJob(completedJobId);
            completedJob = job;
            jobStatus = job.status;
            toolType = job.tool_type ?? undefined;
            if (job.status === "failed") {
              failedJobError = job.error ?? null;
              failedPointsCost = job.points_cost ?? 0;
            }
            if (
              job.tool_type &&
              job.status === "succeeded" &&
              !canvasRef.current?.isInRefineMode()
            ) {
              const provider = formatToolProviderLabel(job.image_provider);
              if (provider) {
                setSelectSourceBanner(`精修完成 · ${provider}`);
              }
            }
          } catch {
            /* 忽略 provider 展示失败 */
          }
        }
        await loadCanvas({ force: true });
        await refreshUser();
        setSessions(
          await listSessions(
            STUDIO_SIDEBAR_SESSION_LIMIT,
            undefined,
            activeWorkspaceId ?? undefined,
          ),
        );
        if (jobStatus === "failed") {
          setJobFailed(true);
          setJobError(failedJobError);
          setJobFailedToolType(toolType ?? null);
          const friendly = formatJobErrorMessage(failedJobError, { toolType });
          const refundHint =
            failedPointsCost > 0
              ? `，已退回 ${failedPointsCost} 积分`
              : "，积分已退回";
          setSelectSourceBanner(
            friendly
              ? `${friendly}${refundHint}`
              : (failedJobError ?? `生成失败${refundHint}`),
          );
        } else if (jobStatus === "succeeded") {
          setJobFailed(false);
          setJobError(null);
          setJobFailedToolType(null);
          if (completedJob && toolType && isToolGridToolId(toolType)) {
            const urls = [...(completedJob.outputs ?? [])]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((o) => o.url)
              .filter(Boolean);
            if (urls.length > 0) {
              setToolGridResult({ toolId: toolType, urls });
            }
          }
        } else if (
          completedJobId &&
          (jobStatus === "queued" || jobStatus === "running")
        ) {
          completingJobIdRef.current = null;
          setJobStreamStatus(jobStatus);
          setSelectSourceBanner("生成仍在进行，正在继续等待结果…");
          setJobWatchSeq((n) => n + 1);
          return;
        }
        setPollingJobId(null);
        setJobStreamStatus(null);
        setJobProgressCompleted(0);
        setJobProgressTotal(0);
        setJobStartedAt(null);
        setQueueAhead(null);
        setActiveJobPrompt(null);
        lastOutputCountRef.current = 0;
        router.replace(
          `/studio?sessionId=${encodeURIComponent(sessionId)}&mode=${mode}`,
        );
        if (canvasRef.current?.isInRefineMode()) {
          if (jobStatus === "succeeded") {
            canvasRef.current.completeRefineJob({ toolName: toolType });
          } else {
            canvasRef.current.cancelRefineJob();
          }
        } else {
          setSelectedCanvasId(null);
          window.requestAnimationFrame(() => scrollToLatestCanvasBatch());
        }
      } finally {
        if (completedJobId && completingJobIdRef.current === completedJobId) {
          completingJobIdRef.current = null;
        }
      }
    },
    [
      sessionId,
      mode,
      router,
      loadCanvas,
      refreshUser,
      activeWorkspaceId,
      setSessions,
      setSelectedCanvasId,
      setSelectSourceBanner,
      setToolGridResult,
      scrollToLatestCanvasBatch,
      canvasRef,
    ],
  );

  handleJobCompleteRef.current = handleJobComplete;

  const handleJobStarted = useCallback(
    (jobId: string, lineage?: PendingBatchLineage) => {
      if (lineage) registerBatchLineage(jobId, lineage);
      if (canvasRef.current?.isInRefineMode()) {
        canvasRef.current.beginRefineJob();
      } else {
        setSelectedCanvasId(null);
        window.requestAnimationFrame(() => {
          canvasRef.current?.scrollToGenerating();
        });
      }
      setActiveJobPrompt(studioPrompt.trim() || null);
      setPollingJobId(jobId);
      void listSessions(
        STUDIO_SIDEBAR_SESSION_LIMIT,
        undefined,
        activeWorkspaceId ?? undefined,
      ).then(setSessions);
    },
    [
      registerBatchLineage,
      studioPrompt,
      activeWorkspaceId,
      setSessions,
      setSelectedCanvasId,
      canvasRef,
    ],
  );

  const handleCancelJob = useCallback(async () => {
    if (!pollingJobId || !user) return;
    try {
      const result = await cancelJob(pollingJobId);
      setPollingJobId(null);
      setJobStreamStatus(null);
      setJobProgressCompleted(0);
      setJobProgressTotal(0);
      setJobStartedAt(null);
      setQueueAhead(null);
      setActiveJobPrompt(null);
      setSelectSourceBanner(
        `任务已取消，积分已退回（${result.refundedPoints}积分）`,
      );
      await refreshUser();
      await loadCanvas({ force: true });
    } catch (err) {
      setSelectSourceBanner(
        err instanceof Error ? err.message : "取消任务失败",
      );
    }
  }, [
    pollingJobId,
    user,
    refreshUser,
    loadCanvas,
    setSelectSourceBanner,
  ]);

  useEffect(() => {
    if (!initialJobId || !user) return;
    let cancelled = false;
    void fetchJob(initialJobId)
      .then((job) => {
        if (cancelled) return;
        if (job.status === "succeeded" || job.status === "failed") {
          setPollingJobId(null);
          setJobStreamStatus(null);
          setActiveJobPrompt(null);
          void loadCanvasRef.current({ force: true });
          if (job.status === "failed") {
            setJobFailed(true);
            setJobError(job.error ?? null);
            setJobFailedToolType(job.tool_type ?? null);
            const friendly = formatJobErrorMessage(job.error, {
              toolType: job.tool_type,
            });
            const refundHint =
              job.points_cost > 0
                ? `，已退回 ${job.points_cost} 积分`
                : "，积分已退回";
            setSelectSourceBanner(
              friendly
                ? `${friendly}${refundHint}`
                : (job.error ?? `生成失败${refundHint}`),
            );
            void refreshUser();
          }
          router.replace(
            `/studio?sessionId=${encodeURIComponent(sessionId)}&mode=${mode}`,
          );
          return;
        }
        setPollingJobId(initialJobId);
      })
      .catch(() => {
        if (!cancelled) setPollingJobId(initialJobId);
      });
    return () => {
      cancelled = true;
    };
  }, [
    initialJobId,
    user,
    sessionId,
    mode,
    router,
    refreshUser,
    loadCanvasRef,
    setSelectSourceBanner,
  ]);

  useEffect(() => {
    if (!pollingJobId || !user) return;
    const t0 = performance.now();
    const jobId = pollingJobId;
    let cancelled = false;

    void fetchJob(jobId)
      .then((job) => {
        if (cancelled) return;
        setJobStreamStatus(job.status);
        if (job.count) setJobProgressTotal(job.count);
        setQueueAhead(job.queue_ahead ?? null);
        if (job.status === "succeeded" || job.status === "failed") {
          if (job.status === "failed") {
            setJobFailed(true);
            setJobError(job.error ?? null);
          }
          void handleJobCompleteRef.current(jobId);
        }
      })
      .catch(() => {
        if (!cancelled) setJobStreamStatus("queued");
      });

    setJobFailed(false);
    setJobError(null);
    setJobFailedToolType(null);
    setJobProgressCompleted(0);
    setJobStartedAt(Date.now());
    lastOutputCountRef.current = 0;
    const tickTimer = window.setInterval(() => setJobTick((n) => n + 1), 1000);
    const stop = watchJob(
      jobId,
      (ev) => {
        setJobStreamStatus(ev.status);
        if (ev.count) setJobProgressTotal(ev.count);
        if (ev.queueAhead !== undefined) setQueueAhead(ev.queueAhead);
        if (typeof ev.completed === "number") {
          setJobProgressCompleted(ev.completed);
          if (
            ev.status === "running" &&
            ev.completed > lastOutputCountRef.current
          ) {
            lastOutputCountRef.current = ev.completed;
            void loadCanvasRef.current({ force: true });
          }
        }
        if (ev.status === "failed") {
          setJobFailed(true);
          setJobError(ev.error ?? null);
        }
      },
      () => {
        void handleJobCompleteRef.current(jobId);
      },
      async (err) => {
        try {
          const job = await fetchJob(jobId);
          if (job.status === "succeeded" || job.status === "failed") {
            void handleJobCompleteRef.current(jobId);
            return;
          }
          if (job.status === "queued" || job.status === "running") {
            completingJobIdRef.current = null;
            setJobStreamStatus(job.status);
            setSelectSourceBanner(JOB_STREAM_STILL_RUNNING_HINT);
            setJobWatchSeq((n) => n + 1);
            return;
          }
        } catch {
          /* fall through */
        }
        void trackEvent("generation_fail", {
          job_id: jobId,
          error_code: "STREAM_ERROR",
          duration_ms: Math.round(performance.now() - t0),
        });
        setJobFailed(true);
        const streamMsg =
          err instanceof Error ? err.message : JOB_STREAM_DISCONNECTED_HINT;
        setJobError(streamMsg);
        setPollingJobId(null);
        setActiveJobPrompt(null);
        setJobStreamStatus("failed");
      },
    );
    return () => {
      cancelled = true;
      window.clearInterval(tickTimer);
      stop();
    };
  }, [pollingJobId, user, jobWatchSeq, loadCanvasRef, setSelectSourceBanner]);

  const jobElapsedMs =
    jobStartedAt != null ? Date.now() - jobStartedAt : undefined;

  const infiniteEmptySubmitting =
    Boolean(jobStreamStatus) &&
    jobStreamStatus !== "succeeded" &&
    jobStreamStatus !== "failed";

  return {
    pollingJobId,
    setPollingJobId,
    jobStreamStatus,
    jobProgressCompleted,
    jobProgressTotal,
    queueAhead,
    activeJobPrompt,
    jobFailed,
    jobError,
    jobFailedToolType,
    jobElapsedMs,
    infiniteEmptySubmitting,
    jobStartedAt,
    dismissJobFailure,
    handleJobStarted,
    handleJobComplete,
    handleCancelJob,
  };
}
