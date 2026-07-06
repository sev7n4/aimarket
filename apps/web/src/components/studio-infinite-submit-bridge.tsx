"use client";

import { useEffect } from "react";
import type { CreationMode } from "@aimarket/ui";

import { useStudioSubmit } from "@/hooks/use-studio-submit";
import type { CanvasItem } from "@/lib/canvas-tools";
import type { PendingBatchLineage } from "@/lib/canvas-tools";

type StudioInfiniteSubmitBridgeProps = {
  sessionId: string;
  mode: CreationMode;
  prompt: string;
  readOnly: boolean;
  user: unknown;
  canvasItems: CanvasItem[];
  onJobStarted: (jobId: string, lineage?: PendingBatchLineage) => void;
  onAuthRequired?: () => void;
  onPromptClear?: () => void;
  onInteractionHint?: (message: string) => void;
  onReady: (api: { submit: () => Promise<void>; submitting: boolean }) => void;
};

/** 在 StudioOrchestrationProvider 内注册 Infinite 空画布直调提交 */
export function StudioInfiniteSubmitBridge(props: StudioInfiniteSubmitBridgeProps) {
  const { submit, submitting } = useStudioSubmit(props);

  useEffect(() => {
    props.onReady({ submit, submitting });
  }, [submit, submitting, props.onReady]);

  return null;
}
