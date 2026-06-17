"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelDramaRun,
  confirmDramaRun,
  createDramaRun,
  fetchDramaRun,
  planDramaProject,
  retryDramaProduction,
  startDramaProduction,
  updateDramaProjectApi,
} from "@/lib/api-client";
import type { DramaProject, DramaProjectPayload, DramaRun } from "@/lib/types";

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
  const [draftProject, setDraftProject] = useState<DramaProject | null>(null);
  const [busy, setBusy] = useState(false);
  const lastJobRef = useRef<string | null>(null);
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

  useEffect(() => {
    if (!run?.id || TERMINAL.has(run.status)) return;
    const id = run.id;
    const tick = window.setInterval(() => {
      void fetchDramaRun(id)
        .then(syncRun)
        .catch(() => {});
    }, 1500);
    return () => window.clearInterval(tick);
  }, [run?.id, run?.status, syncRun]);

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
        return next;
      } finally {
        setBusy(false);
      }
    },
    [run?.id, enabled, syncRun],
  );

  return {
    run,
    draftProject,
    busy,
    planOnly,
    startProduction,
    startFullRun,
    confirmRun,
    cancelRun,
    saveDraftProject,
    retryProduction,
    setRun,
    setDraftProject,
  };
}
