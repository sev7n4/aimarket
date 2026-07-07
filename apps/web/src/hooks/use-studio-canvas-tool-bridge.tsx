import { useCallback, useMemo, type ReactNode } from "react";

import { CanvasSelectionToolbar } from "@/components/canvas-selection-toolbar";
import type { StudioCanvasToolProps } from "@/components/studio-tool-handlers-provider";
import type { StudioBrushRequest, StudioExpandRequest } from "@/lib/canvas-node-handlers";
import type { CanvasItem } from "@/lib/canvas-tools";
import { assetUrl, publishCanvasToInspiration } from "@/lib/api-client";
import { copyTextToClipboard } from "@/lib/clipboard";
import { paddingToExtend } from "@/lib/expand-frame";
import { hapticLight } from "@/lib/haptics";
import { buildToolPromptSuffix } from "@/lib/studio-tool-interaction";
import type { StudioTool } from "@/lib/types";

export interface UseStudioCanvasToolBridgeParams {
  readOnly: boolean;
  mobile: boolean;
  tools: StudioTool[];
  canvasItems: CanvasItem[];
  selectedCanvasItem: CanvasItem | null;
  pendingToolId: string | null;
  brushRequest: StudioBrushRequest | null;
  setBrushRequest: React.Dispatch<React.SetStateAction<StudioBrushRequest | null>>;
  expandRequest: StudioExpandRequest | null;
  setExpandRequest: React.Dispatch<React.SetStateAction<StudioExpandRequest | null>>;
  focusClickRequest: StudioCanvasToolProps["focusClickRequest"];
  handleFocusImageClick: (
    item: CanvasItem,
    point: { x: number; y: number },
  ) => void | Promise<void>;
  runSelectionTool: (tool: StudioTool, item: CanvasItem) => Promise<void>;
  runQuickToolFromCanvas: (
    item: CanvasItem,
    toolId: "cutout" | "expand",
  ) => void;
  runInfiniteNodeTool: (
    request: import("@/lib/infinite-node-tool-run").InfiniteNodeToolRequest,
  ) => Promise<void>;
  executeDirectTool: (
    tool: StudioTool,
    item: CanvasItem,
    opts: import("@/components/tool-confirm-dialog").ToolConfirmOptions,
  ) => Promise<void>;
  handleRerun: (item: CanvasItem) => void | Promise<void>;
  handleExtractVideoLastFrame: (item: CanvasItem) => void | Promise<void>;
  handleAddVideoBgm: (item: CanvasItem) => void;
  videoActionBusy: boolean;
  setMentionItemRequest: React.Dispatch<
    React.SetStateAction<import("@/lib/canvas-node-handlers").StudioMentionItemRequest | null>
  >;
  setSelectSourceBanner: (message: string | null) => void;
}

export function useStudioCanvasToolBridge({
  readOnly,
  mobile,
  tools,
  canvasItems,
  selectedCanvasItem,
  pendingToolId,
  brushRequest,
  setBrushRequest,
  expandRequest,
  setExpandRequest,
  focusClickRequest,
  handleFocusImageClick,
  runSelectionTool,
  runQuickToolFromCanvas,
  runInfiniteNodeTool,
  executeDirectTool,
  handleRerun,
  handleExtractVideoLastFrame,
  handleAddVideoBgm,
  videoActionBusy,
  setMentionItemRequest,
  setSelectSourceBanner,
}: UseStudioCanvasToolBridgeParams): StudioCanvasToolProps {
  const nodeActions = useMemo(
    (): StudioCanvasToolProps["nodeActions"] => ({
      onCutoutItem: (item) => runQuickToolFromCanvas(item, "cutout"),
      onExpandItem: (item) => runQuickToolFromCanvas(item, "expand"),
      onRerun: (item) => void handleRerun(item),
      onRunInfiniteNodeTool: (req) => void runInfiniteNodeTool(req),
      batchTools: {
        tools,
        pendingToolId,
        onRunTool: (tool, item) => void runSelectionTool(tool, item),
        onMentionItem: (item) => {
          setMentionItemRequest((prev) => ({
            key: (prev?.key ?? 0) + 1,
            item,
          }));
          hapticLight();
        },
        onExtractVideoLastFrame: (item) => void handleExtractVideoLastFrame(item),
        onAddVideoBgm: handleAddVideoBgm,
        videoActionBusy,
      },
      onShareItem: async (item) => {
        try {
          await copyTextToClipboard(assetUrl(item.url));
          setSelectSourceBanner("图片链接已复制，可粘贴分享");
        } catch {
          setSelectSourceBanner("复制失败，请重试");
        }
      },
      onPublishItem: async (item) => {
        if (!item.outputId) {
          setSelectSourceBanner("仅支持发布已生成的图片或视频");
          return;
        }
        try {
          await publishCanvasToInspiration({
            outputId: item.outputId,
          });
          setSelectSourceBanner(
            "已发布到灵感发现 · 他人可制作同款并注入提示词",
          );
          hapticLight();
        } catch (err) {
          setSelectSourceBanner(
            err instanceof Error ? err.message : "发布失败，请重试",
          );
        }
      },
    }),
    [
      tools,
      pendingToolId,
      videoActionBusy,
      runQuickToolFromCanvas,
      handleRerun,
      runInfiniteNodeTool,
      runSelectionTool,
      handleExtractVideoLastFrame,
      handleAddVideoBgm,
      setMentionItemRequest,
      setSelectSourceBanner,
    ],
  );

  const onFocusClickCancel = useCallback(() => {
    setSelectSourceBanner(
      "点选已完成：请在工作站补充 prompt 并提交焦点编辑。",
    );
  }, [setSelectSourceBanner]);

  const onExpandCancel = useCallback(() => {
    setExpandRequest(null);
    setSelectSourceBanner(null);
  }, [setExpandRequest, setSelectSourceBanner]);

  const onExpandComplete = useCallback(
    (
      padding: import("@/lib/expand-frame").ExpandFramePadding,
      aspect: import("@/lib/expand-frame").ExpandAspectPreset,
    ) => {
      const item = canvasItems.find((i) => i.id === expandRequest?.itemId);
      const tool = tools.find((t) => t.id === "expand");
      if (!item || !tool) return;
      const extend = paddingToExtend(padding, item.width, item.height);
      const promptExtra = expandRequest?.promptExtra ?? "";
      setExpandRequest(null);
      void executeDirectTool(tool, item, {
        count: 1,
        prompt: promptExtra || undefined,
        expandDirection: undefined,
        expandExtend: extend,
        expandAspectPreset: aspect,
      });
    },
    [canvasItems, expandRequest, tools, setExpandRequest, executeDirectTool],
  );

  const onBrushCancel = useCallback(() => {
    setBrushRequest(null);
    setSelectSourceBanner(null);
  }, [setBrushRequest, setSelectSourceBanner]);

  const onBrushComplete = useCallback(
    (selection: import("@/lib/canvas-tools").CanvasMaskSelection) => {
      const item = canvasItems.find((i) => i.id === selection.itemId);
      if (!item) return;
      const tool = tools.find((t) => t.id === selection.toolId);
      const promptExtra = brushRequest?.promptExtra ?? "";
      setBrushRequest(null);
      setMentionItemRequest((prev) => ({
        key: (prev?.key ?? 0) + 1,
        item,
        promptSuffix:
          buildToolPromptSuffix(
            tool ?? {
              id: selection.toolId,
              name: "局部编辑",
              description: "",
              defaultPrompt: "请根据圈选区域进行局部编辑",
            },
          ) + promptExtra,
        maskSelection: selection,
      }));
      setSelectSourceBanner(
        selection.toolId === "inpaint"
          ? "已完成圈选：请在工作台填写要将该区域改成什么，然后提交。"
          : "已完成圈选：区域 mask 已加入工作台，可补充说明后提交。",
      );
      hapticLight();
    },
    [
      canvasItems,
      tools,
      brushRequest,
      setBrushRequest,
      setMentionItemRequest,
      setSelectSourceBanner,
    ],
  );

  const selectionToolbar: ReactNode = (
    <CanvasSelectionToolbar
      tools={tools}
      selectedItem={selectedCanvasItem}
      readOnly={readOnly}
      pendingToolId={pendingToolId}
      layout={mobile ? "horizontal" : "vertical"}
      onRunTool={(tool, item) => void runSelectionTool(tool, item)}
      onMentionItem={(item) => {
        setMentionItemRequest((prev) => ({
          key: (prev?.key ?? 0) + 1,
          item,
        }));
        hapticLight();
      }}
    />
  );

  return useMemo(
    () => ({
      nodeActions,
      brushRequest,
      expandRequest,
      focusClickRequest,
      onFocusImageClick: (item, point) => void handleFocusImageClick(item, point),
      onFocusClickCancel,
      onExpandCancel,
      onExpandComplete,
      onBrushCancel,
      onBrushComplete,
      selectionToolbar,
    }),
    [
      nodeActions,
      brushRequest,
      expandRequest,
      focusClickRequest,
      handleFocusImageClick,
      onFocusClickCancel,
      onExpandCancel,
      onExpandComplete,
      onBrushCancel,
      onBrushComplete,
      selectionToolbar,
    ],
  );
}
