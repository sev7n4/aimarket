"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelSkillRun,
  confirmSkillRun,
  createSkillRun,
  fetchAgentSkills,
  fetchSkillRun,
} from "@/lib/api/agent";
import type { AgentSkillPublic, SkillRun } from "@/lib/types";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

interface UseSkillRunOptions {
  sessionId?: string;
  enabled: boolean;
  onJobStarted?: (jobId: string) => void;
  onRunSettled?: (run: SkillRun) => void;
}

export function useSkillRun({
  sessionId,
  enabled,
  onJobStarted,
  onRunSettled,
}: UseSkillRunOptions) {
  const [skills, setSkills] = useState<AgentSkillPublic[]>([]);
  const [run, setRun] = useState<SkillRun | null>(null);
  const [busy, setBusy] = useState(false);
  const lastJobRef = useRef<string | null>(null);
  const onJobStartedRef = useRef(onJobStarted);
  const onRunSettledRef = useRef(onRunSettled);

  onJobStartedRef.current = onJobStarted;
  onRunSettledRef.current = onRunSettled;

  useEffect(() => {
    if (!enabled) {
      setSkills([]);
      return;
    }
    void fetchAgentSkills()
      .then(setSkills)
      .catch(() => setSkills([]));
  }, [enabled]);

  const syncRun = useCallback((next: SkillRun) => {
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
      void fetchSkillRun(id)
        .then(syncRun)
        .catch(() => {});
    }, 1500);
    return () => window.clearInterval(tick);
  }, [run?.id, run?.status, syncRun]);

  const startRun = useCallback(
    async (
      skillId: string,
      input: {
        prompt: string;
        productAssetId?: string;
        referenceAssetId?: string;
        confirmed?: boolean;
      },
    ) => {
      if (!sessionId || !enabled) return null;
      setBusy(true);
      lastJobRef.current = null;
      try {
        const created = await createSkillRun(skillId, {
          sessionId,
          prompt: input.prompt.trim(),
          productAssetId: input.productAssetId,
          referenceAssetId: input.referenceAssetId,
          confirmed: input.confirmed,
        });
        syncRun(created);
        return created;
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
      const next = await confirmSkillRun(run.id);
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
      const next = await cancelSkillRun(run.id);
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
    skills,
    run,
    busy,
    startRun,
    confirmRun,
    cancelRun,
    resetRun,
    setRun,
  };
}
