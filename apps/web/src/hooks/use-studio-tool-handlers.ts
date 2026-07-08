import { useCallback, useState } from "react";

import type {
  CanvasNodeHandlerContext,
  StudioBrushRequest,
  StudioExpandRequest,
  UseStudioToolHandlersResult,
} from "@/lib/canvas-node-handlers";
import type { CanvasItem } from "@/lib/canvas-tools";
import type {
  ToolConfirmOptions,
  ToolConfirmRequest,
} from "@/components/tool-confirm-dialog";
import { expandFromDirection } from "@/lib/expand-extend";
import type { InfiniteNodeToolRequest } from "@/lib/infinite-node-tool-run";
import {
  resolveNodeToolPrompt,
  resolveNodeToolReferences,
} from "@/lib/infinite-node-tool-run";
import { runTool } from "@/lib/api/generation";
import { trackEvent } from "@/lib/api/studio";
import { hapticLight } from "@/lib/haptics";
import { resolveToolResolution } from "@/lib/tool-resolution";
import {
  buildToolPromptSuffix,
  getToolInteraction,
} from "@/lib/studio-tool-interaction";
import type { StudioTool } from "@/lib/types";

export type { UseStudioToolHandlersResult } from "@/lib/canvas-node-handlers";

/** Studio 画布工具执行：选中工具栏 / Infinite 节点菜单 / 确认弹窗 */
export function useStudioToolHandlers(
  ctx: CanvasNodeHandlerContext,
): UseStudioToolHandlersResult {
  const {
    sessionId,
    readOnly,
    user,
    tools,
    canvasItems,
    canvasRef,
    registerBatchLineage,
    onJobStarted,
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
  const [brushRequest, setBrushRequest] = useState<StudioBrushRequest | null>(
    null,
  );
  const [expandRequest, setExpandRequest] = useState<StudioExpandRequest | null>(
    null,
  );

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
          aspectRatio: tool.id === "expand" ? "auto" : undefined,
          count: tool.id === "variation" ? opts.count : 1,
          ...(tool.id === "upscale"
            ? { scale: opts.scale ?? ("2x" as const) }
            : {}),
          ...(tool.id === "expand"
            ? {
                extend:
                  opts.expandExtend ??
                  expandFromDirection(opts.expandDirection),
              }
            : {}),
        });
        void trackEvent("tool_run", {
          tool_id: tool.id,
          job_id: jobId,
          has_reference: true,
          count: tool.id === "variation" ? opts.count : 1,
        });
        registerToolBatchLineage(jobId, item, tool.name);
        if (canvasRef.current?.isInRefineMode()) {
          canvasRef.current.beginRefineJob();
        }
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

  const runInfiniteNodeTool = useCallback(
    async (request: InfiniteNodeToolRequest) => {
      if (readOnly || !sessionId) return;
      const tool =
        tools.find((t) => t.id === request.toolId) ??
        ({
          id: request.toolId,
          name: request.toolId,
          description: "",
          defaultPrompt: "",
        } satisfies StudioTool);
      const item =
        canvasItems.find((i) => i.id === request.node.id) ?? null;
      const refs = resolveNodeToolReferences(request.node, item);
      const prompt =
        request.prompt?.trim() ||
        resolveNodeToolPrompt(request.node, tool.defaultPrompt);

      if (
        tool.requiresSource &&
        !refs.referenceOutputIds?.length &&
        !refs.assetIds?.length
      ) {
        setSelectSourceBanner(
          `${tool.name}：请先生成分镜图或选择带参考图的节点`,
        );
        return;
      }

      setPendingToolId(tool.id);
      try {
        const { jobId } = await runTool(tool.id, {
          sessionId,
          prompt,
          referenceOutputIds: refs.referenceOutputIds,
          assetIds: refs.assetIds,
          resolution: resolveToolResolution(tool.id),
          aspectRatio: tool.id === "expand" ? "auto" : undefined,
          toolContext: request.toolContext
            ? {
                toolId: request.toolId,
                ...request.toolContext,
              }
            : undefined,
        });
        void trackEvent("tool_run", {
          tool_id: tool.id,
          job_id: jobId,
          has_reference: Boolean(
            refs.referenceOutputIds?.length || refs.assetIds?.length,
          ),
          source: "infinite_context_menu",
        });
        if (item) {
          registerToolBatchLineage(jobId, item, tool.name);
        }
        onJobStarted(jobId);
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
      readOnly,
      sessionId,
      tools,
      canvasItems,
      registerToolBatchLineage,
      onJobStarted,
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
    (item: CanvasItem, toolId: "cutout" | "expand") => {
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

      if (interaction === "brush") {
        setToolConfirm(null);
        setExpandRequest(null);
        setBrushRequest({
          key: Date.now(),
          itemId: item.id,
          toolId: tool.id,
          toolName: tool.name,
          promptExtra:
            tool.id === "erase" ? opts.prompt?.trim() || undefined : undefined,
        });
        setSelectSourceBanner(
          tool.id === "inpaint"
            ? `${tool.name}：请先用画笔圈选区域，完成后再在工作台填写修改提示词。`
            : `${tool.name}：请在图片上涂抹要处理的区域（可调节画笔粗细）。`,
        );
        hapticLight();
        return;
      }

      if (interaction === "expand-frame") {
        setToolConfirm(null);
        setBrushRequest(null);
        setExpandRequest({
          key: Date.now(),
          itemId: item.id,
          toolName: tool.name,
          promptExtra: opts.prompt?.trim() || undefined,
          aspectPreset: opts.expandAspectPreset,
        });
        setSelectSourceBanner(
          `${tool.name}：拖拽外框四角或四边调整扩图范围，可选比例后确认。`,
        );
        hapticLight();
        return;
      }

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
    brushRequest,
    setBrushRequest,
    expandRequest,
    setExpandRequest,
    runSelectionTool,
    runQuickToolFromCanvas,
    runInfiniteNodeTool,
    executeDirectTool,
    confirmTool,
  };
}
