import { useCallback, useMemo, type ReactNode } from "react";

import { CanvasSelectionToolbar } from "@/components/canvas-selection-toolbar";
import type { StudioCanvasToolProps } from "@/components/studio-tool-handlers-provider";
import type { CanvasItem } from "@/lib/canvas-tools";
import { assetUrl } from "@/lib/api/core";
import { publishCanvasToInspiration } from "@/lib/api/inspiration";
import { copyTextToClipboard } from "@/lib/clipboard";
import { hapticLight } from "@/lib/haptics";
import type { StudioTool } from "@/lib/types";

export interface UseStudioCanvasToolBridgeParams {
  readOnly: boolean;
  mobile: boolean;
  tools: StudioTool[];
  canvasItems: CanvasItem[];
  selectedCanvasItem: CanvasItem | null;
  pendingToolId: string | null;
  focusClickRequest: StudioCanvasToolProps["focusClickRequest"];
  handleFocusImageClick: (
    item: CanvasItem,
    point: { x: number; y: number },
  ) => void | Promise<void>;
  runSelectionTool: (tool: StudioTool, item: CanvasItem) => Promise<void>;
  runQuickToolFromCanvas: (item: CanvasItem, toolId: "cutout") => void;
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
    React.SetStateAction<import("@/lib/studio-tool-handler-types").StudioMentionItemRequest | null>
  >;
  setSelectSourceBanner: (message: string | null) => void;
}

export function useStudioCanvasToolBridge({
  readOnly,
  mobile,
  tools,
  selectedCanvasItem,
  pendingToolId,
  focusClickRequest,
  handleFocusImageClick,
  runSelectionTool,
  runQuickToolFromCanvas,
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
      onRerun: (item) => void handleRerun(item),
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
      focusClickRequest,
      onFocusImageClick: (item, point) => void handleFocusImageClick(item, point),
      onFocusClickCancel,
      selectionToolbar,
    }),
    [
      nodeActions,
      focusClickRequest,
      handleFocusImageClick,
      onFocusClickCancel,
      selectionToolbar,
    ],
  );
}
