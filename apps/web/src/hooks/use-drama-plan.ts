"use client";

import { useCallback, useRef, useState, type MutableRefObject } from "react";
import {
  createDramaPlanRun,
  fetchDramaPlanRun,
  rerunDramaPlanRun,
} from "@/lib/api-client";
import {
  pollDramaPlanRun,
  streamDramaPlanRun,
  type DramaPlanStreamEvent,
} from "@/lib/drama-plan-stream";
import type { DramaProject } from "@/lib/types";

export interface DramaPlanRunState {
  id: string;
  status: "planning" | "completed" | "failed";
  currentAgent?: string | null;
  projectId?: string;
  estimatedPoints?: number;
  error?: string | null;
}

interface UseDramaPlanOptions {
  sessionId?: string;
  enabled: boolean;
  onComplete?: (
    project: DramaProject,
    estimatedPoints: number,
    dramaRunId?: string,
  ) => void;
  onFailed?: (error: string) => void;
}

function connectPlanStream(
  runId: string,
  onEvent: (event: DramaPlanStreamEvent) => void,
  handleTerminal: (runId: string) => Promise<void>,
  onFailedRef: MutableRefObject<((error: string) => void) | undefined>,
): () => void {
  const finish = () => {
    void handleTerminal(runId);
  };

  return streamDramaPlanRun(
    runId,
    onEvent,
    finish,
    () => {
      return pollDramaPlanRun(
        runId,
        () => {},
        finish,
        (err) => onFailedRef.current?.(err.message),
      );
    },
  );
}

export function useDramaPlan({
  sessionId,
  enabled,
  onComplete,
  onFailed,
}: UseDramaPlanOptions) {
  const [planRun, setPlanRun] = useState<DramaPlanRunState | null>(null);
  const [events, setEvents] = useState<DramaPlanStreamEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onFailedRef = useRef(onFailed);
  const dramaRunIdRef = useRef<string | undefined>(undefined);
  onCompleteRef.current = onComplete;
  onFailedRef.current = onFailed;

  const handleTerminal = useCallback(async (runId: string) => {
    try {
      const run = await fetchDramaPlanRun(runId);
      setPlanRun({
        id: run.id,
        status: run.status,
        currentAgent: run.currentAgent,
        projectId: run.projectId ?? undefined,
        estimatedPoints: run.estimatedPoints,
        error: run.error,
      });
      if (run.status === "completed" && run.project) {
        onCompleteRef.current?.(
          run.project,
          run.estimatedPoints ?? 0,
          dramaRunIdRef.current,
        );
      } else if (run.status === "failed") {
        onFailedRef.current?.(run.error ?? "规划失败");
      }
      dramaRunIdRef.current = undefined;
    } catch {
      /* ignore */
    }
  }, []);

  const watchRun = useCallback(
    (runId: string, resetEvents: boolean) => {
      stopRef.current?.();
      if (resetEvents) setEvents([]);
      dramaRunIdRef.current = undefined;

      const onEvent = (event: DramaPlanStreamEvent) => {
        setEvents((prev) => [...prev, event]);
        if (event.type === "agent_start") {
          setPlanRun((prev) =>
            prev ? { ...prev, status: "planning", currentAgent: event.agent } : prev,
          );
        }
        if (event.type === "plan_complete" && event.dramaRunId) {
          dramaRunIdRef.current = event.dramaRunId;
        }
      };

      stopRef.current = connectPlanStream(
        runId,
        onEvent,
        handleTerminal,
        onFailedRef,
      );
    },
    [handleTerminal],
  );

  const startPlan = useCallback(
    async (
      userIdea: string,
      options?: {
        targetDurationSec?: number;
        aspectRatio?: "9:16" | "16:9";
        autoProduce?: boolean;
      },
    ) => {
      if (!sessionId || !enabled) return null;
      stopRef.current?.();
      setBusy(true);
      setEvents([]);
      try {
        const created = await createDramaPlanRun({
          sessionId,
          userIdea,
          targetDurationSec: options?.targetDurationSec,
          aspectRatio: options?.aspectRatio,
          autoProduce: options?.autoProduce,
        });
        setPlanRun({
          id: created.id,
          status: created.status,
          currentAgent: created.currentAgent,
        });
        watchRun(created.id, false);
        return created;
      } finally {
        setBusy(false);
      }
    },
    [sessionId, enabled, watchRun],
  );

  const rerunPlan = useCallback(
    async (
      fromAgent: string,
      projectPatch?: Record<string, unknown>,
    ) => {
      if (!planRun?.id || !enabled) return null;
      stopRef.current?.();
      setBusy(true);
      try {
        const updated = await rerunDramaPlanRun(planRun.id, {
          fromAgent,
          projectPatch,
        });
        setPlanRun({
          id: updated.id,
          status: updated.status,
          currentAgent: updated.currentAgent,
          projectId: updated.projectId ?? undefined,
        });
        watchRun(updated.id, true);
        return updated;
      } finally {
        setBusy(false);
      }
    },
    [planRun?.id, enabled, watchRun],
  );

  const cancelWatch = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
  }, []);

  const resetPlan = useCallback(() => {
    cancelWatch();
    setPlanRun(null);
    setEvents([]);
  }, [cancelWatch]);

  return {
    planRun,
    events,
    busy,
    startPlan,
    rerunPlan,
    cancelWatch,
    resetPlan,
  };
}
