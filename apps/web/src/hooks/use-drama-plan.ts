"use client";

import { useCallback, useRef, useState } from "react";
import { createDramaPlanRun, fetchDramaPlanRun } from "@/lib/api-client";
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
  onComplete?: (project: DramaProject, estimatedPoints: number) => void;
  onFailed?: (error: string) => void;
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
        onCompleteRef.current?.(run.project, run.estimatedPoints ?? 0);
      } else if (run.status === "failed") {
        onFailedRef.current?.(run.error ?? "规划失败");
      }
    } catch {
      /* ignore */
    }
  }, []);

  const startPlan = useCallback(
    async (
      userIdea: string,
      options?: {
        targetDurationSec?: number;
        aspectRatio?: "9:16" | "16:9";
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
        });
        setPlanRun({
          id: created.id,
          status: created.status,
          currentAgent: created.currentAgent,
        });

        const onEvent = (event: DramaPlanStreamEvent) => {
          setEvents((prev) => [...prev, event]);
          if (event.type === "agent_start") {
            setPlanRun((prev) =>
              prev ? { ...prev, currentAgent: event.agent } : prev,
            );
          }
        };

        const finish = () => {
          void handleTerminal(created.id);
        };

        stopRef.current = streamDramaPlanRun(
          created.id,
          onEvent,
          finish,
          () => {
            stopRef.current = pollDramaPlanRun(
              created.id,
              (run) => {
                setPlanRun({
                  id: run.id,
                  status: run.status,
                  currentAgent: run.currentAgent,
                  projectId: run.projectId ?? undefined,
                  estimatedPoints: run.estimatedPoints,
                  error: run.error,
                });
              },
              finish,
              (err) => onFailedRef.current?.(err.message),
            );
          },
        );

        return created;
      } finally {
        setBusy(false);
      }
    },
    [sessionId, enabled, handleTerminal],
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
    cancelWatch,
    resetPlan,
  };
}
