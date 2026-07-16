"use client";

import { useCallback, useState } from "react";

import type {
  CanvasNodeHandlerContext,
  UseStudioToolHandlersResult,
} from "@/lib/studio-tool-handler-types";
import type { CanvasItem } from "@/lib/canvas-tools";
import type {
  ToolConfirmOptions,
  ToolConfirmRequest,
} from "@/components/tool-confirm-dialog";
import { runTool } from "@/lib/api/generation";
import { trackEvent } from "@/lib/api/studio";
import { hapticLight } from "@/lib/haptics";
import { resolveToolResolution } from "@/lib/tool-resolution";
import {
  buildToolPromptSuffix,
  getToolInteraction,
} from "@/lib/studio-tool-interaction";
import type { StudioTool } from "@/lib/types";

export type { UseStudioToolHandlersResult } from "@/lib/studio-tool-handler-types";

/** Studio 画布工具执行：选中工具栏 / 确认弹窗 */
export function useStudioToolHandlers(
  ctx: CanvasNodeHandlerContext,
): UseStudioToolHandlersResult {
  const {
    sessionId,
    readOnly,
    user,
    tools,
    canvasRef,
    registerBatchLineage,
    setPollingJobId,
    setSelectedCanvasId,
    onRequireLogin,
    setSelectSourceBanner,
    setMentionItemRequest,
    startFocusEditMode,
  } = ctx;

  const [pendingToolId, setPendingToolId] = useState<string | null>(null);
  const [toolConfirm, setToolConfirm] = useState<ToolConfirmRequest | null>(null);
  const [toolConfirmPending, setToolConfirmPending] = useState(false);

  const registerToolBatchLineage = useCallback(
    (jobId: string, item: CanvasItem, toolName?: string) => {
      registerBatchLineage(jobId, {
        parentBatchId: item.batchId,
        sourceItemId: item.id,
        sourceOutputId: item.outputId,
        toolName,
      });
    },
    [registerBatchLineage],
  );

  const executeDirectTool = useCallback(
    async (tool: StudioTool, item: CanvasItem, opts: ToolConfirmOptions) => {
      const referenceOutputIds = item.outputId ? [item.outputId] : undefined;
      const assetIds =
        !referenceOutputIds && item.assetId ? [item.assetId] : undefined;
      setPendingToolId(tool.id);
      try {
        const userPrompt = opts.prompt?.trim();
        const prompt = userPrompt || tool.defaultPrompt;
        const { jobId } = await runTool(tool.id, {
          sessionId,
          prompt,
          referenceOutputIds,
          assetIds,
          resolution: resolveToolResolution(tool.id),
          count: tool.id === "variation" ? opts.count : 1,
          ...(tool.id === "upscale"
            ? { scale: opts.scale ?? ("2x" as const) }
            : {}),
        });
        void trackEvent("tool_run", {
          tool_id: tool.id,
          job_id: jobId,
          has_reference: true,
          count: tool.id === "variation" ? opts.count : 1,
        });
        registerToolBatchLineage(jobId, item, tool.name);
        setPollingJobId(jobId);
        setSelectSourceBanner(null);
      } catch (err) {
        setSelectSourceBanner(
          err instanceof Error ? err.message : "工具执行失败",
        );
      } finally {
        setPendingToolId(null);
      }
    },
    [
      sessionId,
      registerToolBatchLineage,
      canvasRef,
      setPollingJobId,
      setSelectSourceBanner,
    ],
  );

  const runSelectionTool = useCallback(
    async (tool: StudioTool, item: CanvasItem) => {
      if (!user) {
        onRequireLogin();
        return;
      }
      if (readOnly || tool.clientOnly) return;
      setSelectedCanvasId(item.id);
      const referenceOutputIds = item.outputId ? [item.outputId] : undefined;
      const assetIds =
        !referenceOutputIds && item.assetId ? [item.assetId] : undefined;
      if (tool.requiresSource && !referenceOutputIds && !assetIds) {
        setSelectSourceBanner("请先在画布点选一张已生成的图片");
        return;
      }

      setToolConfirm({ tool, item });
      hapticLight();
    },
    [
      user,
      readOnly,
      onRequireLogin,
      setSelectedCanvasId,
      setSelectSourceBanner,
    ],
  );

  const runQuickToolFromCanvas = useCallback(
    (item: CanvasItem, toolId: "cutout") => {
      const tool = tools.find((t) => t.id === toolId);
      if (!tool) return;
      void runSelectionTool(tool, item);
    },
    [tools, runSelectionTool],
  );

  const confirmTool = useCallback(
    async (opts: ToolConfirmOptions) => {
      if (!toolConfirm) return;
      const { tool, item } = toolConfirm;
      const interaction = getToolInteraction(tool.id);

      if (interaction === "click") {
        setToolConfirm(null);
        const suffix = opts.prompt?.trim()
          ? `${buildToolPromptSuffix(tool)}${opts.prompt.trim()}`
          : buildToolPromptSuffix(tool);
        startFocusEditMode(item, {
          intent: opts.intent,
          promptHint: suffix,
        });
        return;
      }

      if (interaction === "prompt") {
        if (tool.id === "blend") {
          setToolConfirm(null);
          const suffix = opts.prompt?.trim()
            ? `${buildToolPromptSuffix(tool)}${opts.prompt.trim()}`
            : buildToolPromptSuffix(tool);
          setMentionItemRequest((prev) => ({
            key: (prev?.key ?? 0) + 1,
            item,
            promptSuffix: suffix,
          }));
          setSelectSourceBanner(
            `${tool.name}：已把当前图 @ 到工作台，请再 @ 另一张素材并提交。`,
          );
          hapticLight();
          return;
        }
      }

      setToolConfirmPending(true);
      try {
        await executeDirectTool(tool, item, opts);
        setToolConfirm(null);
      } finally {
        setToolConfirmPending(false);
      }
    },
    [
      toolConfirm,
      executeDirectTool,
      setSelectSourceBanner,
      setMentionItemRequest,
      startFocusEditMode,
    ],
  );

  return {
    pendingToolId,
    toolConfirm,
    toolConfirmPending,
    setToolConfirm,
    runSelectionTool,
    runQuickToolFromCanvas,
    executeDirectTool,
    confirmTool,
  };
}
