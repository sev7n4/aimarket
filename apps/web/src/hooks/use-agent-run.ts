"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelAgentRun,
  confirmAgentRun,
  createAgentRun,
  fetchAgentRun,
} from "@/lib/api-client";
import type { CreationMode } from "@aimarket/ui";
import type { AgentRun } from "@/lib/types";
import { toApiCreationMode } from "@/lib/modes";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

interface UseAgentRunOptions {
  sessionId?: string;
  mode: CreationMode;
  enabled: boolean;
  onJobStarted?: (jobId: string) => void;
  onRunSettled?: (run: AgentRun) => void;
}

export function useAgentRun({
  sessionId,
  mode,
  enabled,
  onJobStarted,
  onRunSettled,
}: UseAgentRunOptions) {
  const [run, setRun] = useState<AgentRun | null>(null);
  const [busy, setBusy] = useState(false);
  const lastJobRef = useRef<string | null>(null);
  const onJobStartedRef = useRef(onJobStarted);
  const onRunSettledRef = useRef(onRunSettled);

  onJobStartedRef.current = onJobStarted;
  onRunSettledRef.current = onRunSettled;

  const syncRun = useCallback((next: AgentRun) => {
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
      void fetchAgentRun(id)
        .then(syncRun)
        .catch(() => {});
    }, 1200);
    return () => window.clearInterval(tick);
  }, [run?.id, run?.status, syncRun]);

  const startRun = useCallback(
    async (prompt: string) => {
      if (!sessionId || !enabled) return null;
      setBusy(true);
      lastJobRef.current = null;
      try {
        const created = await createAgentRun({
          sessionId,
          prompt: prompt.trim(),
          mode: toApiCreationMode(mode),
        });
        syncRun(created);
        return created;
      } finally {
        setBusy(false);
      }
    },
    [sessionId, mode, enabled, syncRun],
  );

  const confirmRun = useCallback(async () => {
    if (!run?.id) return null;
    setBusy(true);
    try {
      const next = await confirmAgentRun(run.id);
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
      const next = await cancelAgentRun(run.id);
      syncRun(next);
      return next;
    } finally {
      setBusy(false);
    }
  }, [run?.id, syncRun]);

  const resetRun = useCallback(() => {
    setRun(null);
    lastJobRef.current = null;
  }, []);

  return {
    run,
    busy,
    startRun,
    confirmRun,
    cancelRun,
    resetRun,
    setRun,
  };
}
