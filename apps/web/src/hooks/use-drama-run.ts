"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelDramaRun,
  confirmDramaRun,
  createDramaRun,
  fetchDramaRun,
  fetchDramaRunGraph,
  planDramaProject,
  retryDramaProduction,
  rerunDramaRunFromNode,
  startDramaProduction,
  updateDramaProjectApi,
} from "@/lib/api-client";
import {
  pollDramaRunUpdates,
  streamDramaRun,
  type DramaRunStreamEvent,
} from "@/lib/drama-run-stream";
import type { DramaProject, DramaProjectPayload, DramaRun, DramaRunGraph } from "@/lib/types";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

interface UseDramaRunOptions {
  sessionId?: string;
  enabled: boolean;
  onJobStarted?: (jobId: string) => void;
  onRunSettled?: (run: DramaRun) => void;
}

export function useDramaRun({
  sessionId,
  enabled,
  onJobStarted,
  onRunSettled,
}: UseDramaRunOptions) {
  const [run, setRun] = useState<DramaRun | null>(null);
  const [runGraph, setRunGraph] = useState<DramaRunGraph | null>(null);
  const [draftProject, setDraftProject] = useState<DramaProject | null>(null);
  const [busy, setBusy] = useState(false);
  const lastJobRef = useRef<string | null>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);
  const onJobStartedRef = useRef(onJobStarted);
  const onRunSettledRef = useRef(onRunSettled);

  onJobStartedRef.current = onJobStarted;
  onRunSettledRef.current = onRunSettled;

  const syncRun = useCallback((next: DramaRun) => {
    setRun(next);
    if (next.pendingJobId && next.pendingJobId !== lastJobRef.current) {
      lastJobRef.current = next.pendingJobId;
      onJobStartedRef.current?.(next.pendingJobId);
    }
    if (TERMINAL.has(next.status)) {
      onRunSettledRef.current?.(next);
    }
  }, []);

  const handleStreamEvent = useCallback(
    (event: DramaRunStreamEvent) => {
      if (event.type === "graph_update") {
        setRunGraph(event.graph);
        setRun((prev) =>
          prev && prev.id === event.runId
            ? {
                ...prev,
                status: event.status as DramaRun["status"],
                currentStepIndex: event.currentStepIndex,
              }
            : prev,
        );
      }
    },
    [],
  );

  const handleStreamTerminal = useCallback(
    async (runId: string) => {
      try {
        const next = await fetchDramaRun(runId);
        syncRun(next);
      } catch {
        /* ignore */
      }
    },
    [syncRun],
  );

  useEffect(() => {
    stopStreamRef.current?.();
    stopStreamRef.current = null;

    if (!run?.id || TERMINAL.has(run.status)) {
      return;
    }

    const runId = run.id;
    const onDone = () => {
      void handleStreamTerminal(runId);
    };

    stopStreamRef.current = streamDramaRun(
      runId,
      handleStreamEvent,
      onDone,
      () => {
        stopStreamRef.current = pollDramaRunUpdates(
          runId,
          syncRun,
          onDone,
          () => {},
        );
      },
    );

    return () => {
      stopStreamRef.current?.();
      stopStreamRef.current = null;
    };
  }, [run?.id, run?.status, handleStreamEvent, handleStreamTerminal, syncRun]);

  useEffect(() => {
    if (!run?.id) {
      setRunGraph(null);
      return;
    }
    if (!TERMINAL.has(run.status)) return;
    let cancelled = false;
    void fetchDramaRunGraph(run.id)
      .then((graph) => {
        if (!cancelled) setRunGraph(graph);
      })
      .catch(() => {
        if (!cancelled) setRunGraph(null);
      });
    return () => {
      cancelled = true;
    };
  }, [run?.id, run?.status]);

  const planOnly = useCallback(
    async (userIdea: string, aspectRatio?: "9:16" | "16:9") => {
      if (!sessionId || !enabled) return null;
      setBusy(true);
      try {
        const data = await planDramaProject({
          sessionId,
          userIdea,
          aspectRatio,
        });
        setDraftProject(data.project);
        return data;
      } finally {
        setBusy(false);
      }
    },
    [sessionId, enabled],
  );

  const startProduction = useCallback(
    async (projectId: string, confirmed?: boolean) => {
      if (!sessionId || !enabled) return null;
      setBusy(true);
      try {
        const next = await startDramaProduction({
          sessionId,
          projectId,
          confirmed,
        });
        syncRun(next);
        setRunGraph(null);
        return next;
      } finally {
        setBusy(false);
      }
    },
    [sessionId, enabled, syncRun],
  );

  const startFullRun = useCallback(
    async (
      userIdea: string,
      opts?: { aspectRatio?: "9:16" | "16:9"; confirmed?: boolean },
    ) => {
      if (!sessionId || !enabled) return null;
      setBusy(true);
      try {
        const next = await createDramaRun({
          sessionId,
          userIdea,
          aspectRatio: opts?.aspectRatio,
          confirmed: opts?.confirmed,
        });
        syncRun(next);
        setDraftProject(null);
        setRunGraph(null);
        return next;
      } finally {
        setBusy(false);
      }
    },
    [sessionId, enabled, syncRun],
  );

  const confirmRun = useCallback(async () => {
    if (!run?.id) return null;
    setBusy(true);
    try {
      const next = await confirmDramaRun(run.id);
      syncRun(next);
      return next;
    } finally {
      setBusy(false);
    }
  }, [run?.id, syncRun]);

  const cancelRun = useCallback(async () => {
    if (!run?.id) return null;
    setBusy(true);
    try {
      const next = await cancelDramaRun(run.id);
      syncRun(next);
      return next;
    } finally {
      setBusy(false);
    }
  }, [run?.id, syncRun]);

  const saveDraftProject = useCallback(
    async (project: DramaProjectPayload) => {
      if (!draftProject?.id) return null;
      setBusy(true);
      try {
        const next = await updateDramaProjectApi(draftProject.id, project);
        setDraftProject(next);
        return next;
      } finally {
        setBusy(false);
      }
    },
    [draftProject?.id],
  );

  const retryProduction = useCallback(
    async (fromStep?: string) => {
      if (!run?.id || !enabled) return null;
      setBusy(true);
      try {
        const next = await retryDramaProduction(run.id, fromStep);
        syncRun(next);
        setRunGraph(null);
        return next;
      } finally {
        setBusy(false);
      }
    },
    [run?.id, enabled, syncRun],
  );

  const rerunFromNode = useCallback(
    async (nodeId: string, projectPatch?: Record<string, unknown>) => {
      if (!run?.id || !enabled) return null;
      setBusy(true);
      try {
        const next = await rerunDramaRunFromNode(run.id, nodeId, projectPatch);
        syncRun(next);
        setRunGraph(null);
        return next;
      } finally {
        setBusy(false);
      }
    },
    [run?.id, enabled, syncRun],
  );

  return {
    run,
    runGraph,
    draftProject,
    busy,
    planOnly,
    startProduction,
    startFullRun,
    confirmRun,
    cancelRun,
    saveDraftProject,
    retryProduction,
    rerunFromNode,
    setRun,
    setDraftProject,
    setRunGraph,
  };
}
