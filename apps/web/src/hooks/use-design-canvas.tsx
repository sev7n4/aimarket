import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { Ref } from "react";
import type { CanvasItem } from "@/lib/canvas-tools";
import type { ProductGalleryHandle } from "@/components/product-gallery";
import { MOBILE_BREAKPOINT } from "@/lib/breakpoints";
import { hapticLight } from "@/lib/haptics";
import { assetUrl } from "@/lib/api-client";
import { useIsMobile } from "@/hooks/use-is-mobile";
import type { DesignCanvasHandle, DesignCanvasProps } from "@/components/design-canvas-types";

export function useDesignCanvas(props: DesignCanvasProps, ref: Ref<DesignCanvasHandle>) {
  const {
    items,
    selectedId,
    onSelect,
    onItemsChange,
    onDownload,
    onDeleteSelected,
    emptyHint = "生成结果将显示在画布上",
    readOnly = false,
    jobStreamStatus = null,
    jobFailed = false,
    jobErrorMessage = null,
    jobProgressCompleted = 0,
    jobProgressTotal = 0,
    onOpenChatPanel,
    selectSourceBanner = null,
    showFailureBannerDismiss = false,
    onDismissJobFailure,
    nodeActions,
    focusClickRequest = null,
    onFocusImageClick,
    onFocusClickCancel,
    selectionToolbar = null,
    statusChip = null,
    onJumpToParentBatch,
    onCancelJob,
    jobElapsedMs,
    queueAhead,
    pendingJobPrompt = null,
    jobStartedAt = null,
    scrollBottomInset = "",
    conversationPaneEnabled = false,
    onConversationPaneActiveChange,
    conversationPaneWidth,
    onConversationPaneResizeStart,
    conversationPaneResizing = false,
  } = props;

  const onCutoutItem = nodeActions?.onCutoutItem;
  const onRerun = nodeActions?.onRerun;
  const onDownloadItem = nodeActions?.onDownloadItem;
  const onShareItem = nodeActions?.onShareItem;
  const onPublishItem = nodeActions?.onPublishItem;
  const batchTools = nodeActions?.batchTools;

  const scrollCanvasRef = useRef<ProductGalleryHandle>(null);
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    item: CanvasItem;
    x: number;
    y: number;
  } | null>(null);
  const [lightbox, setLightbox] = useState<{
    items: CanvasItem[];
    index: number;
  } | null>(null);

  const mobile = useIsMobile(MOBILE_BREAKPOINT);

  const focusItem = focusClickRequest
    ? items.find((item) => item.id === focusClickRequest.itemId)
    : null;
  const focusClickActive = Boolean(focusClickRequest && focusItem);

  const pulseItem = useCallback((itemId: string) => {
    setPulseId(itemId);
    hapticLight();
    window.setTimeout(() => setPulseId(null), 2000);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      fitToItem: (itemId: string) => {
        const item = items.find((i) => i.id === itemId);
        if (item?.batchId) {
          scrollCanvasRef.current?.scrollToBatch(item.batchId);
        }
      },
      fitToBatch: (batchId: string) => {
        scrollCanvasRef.current?.scrollToBatch(batchId);
      },
      scrollToGenerating: () => {
        scrollCanvasRef.current?.scrollToGenerating();
      },
      pulseItem,
      fitAll: () => {},
    }),
    [items, pulseItem],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const inInput =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (e.key === "Delete" || e.key === "Backspace") {
        if (inInput) return;
        if (readOnly) return;
        e.preventDefault();
        if (!selectedId) return;
        onDeleteSelected();
      } else if (e.key === "Escape" && focusClickActive) {
        onFocusClickCancel?.();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    selectedId,
    onDeleteSelected,
    readOnly,
    focusClickActive,
    onFocusClickCancel,
  ]);

  const batchSections = useMemo(() => {
    const groups = new Map<string, CanvasItem[]>();
    for (const item of items) {
      const key = item.batchId ?? `item-${item.id}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return Array.from(groups.entries())
      .map(([id, batchItems]) => {
        const minX = Math.min(...batchItems.map((i) => i.x));
        const minY = Math.min(...batchItems.map((i) => i.y));
        const maxX = Math.max(...batchItems.map((i) => i.x + i.width));
        const maxY = Math.max(...batchItems.map((i) => i.y + i.height));
        const first = batchItems[0];
        return {
          id,
          index: first.batchIndex ?? 0,
          title: first.batchTitle ?? "批次",
          subtitle: first.batchSubtitle,
          parentBatchId: first.parentBatchId,
          sourceItemId: first.sourceItemId,
          count: batchItems.length,
          x: minX - 24,
          y: minY - 58,
          width: maxX - minX + 48,
          height: maxY - minY + 88,
        };
      })
      .sort((a, b) => a.index - b.index || a.y - b.y);
  }, [items]);

  const conversationPaneActive =
    conversationPaneEnabled && !mobile;

  useEffect(() => {
    onConversationPaneActiveChange?.(conversationPaneActive);
  }, [conversationPaneActive, onConversationPaneActiveChange]);

  const productGalleryProps = {
    items,
    batchSections,
    selectedId,
    onSelect,
    readOnly,
    emptyHint,
    pulseId,
    onSetLightbox: setLightbox,
    onDeleteSelected,
    onRerun: (item: CanvasItem) => onRerun?.(item),
    onJumpToParentBatch,
    jobStreamStatus,
    jobFailed,
    jobErrorMessage,
    jobProgressCompleted,
    jobProgressTotal,
    onOpenChatPanel,
    onCancelJob,
    onDismissJobFailure,
    jobElapsedMs,
    queueAhead,
    pendingJobPrompt,
    jobStartedAt,
    focusClickActive,
    focusItem: focusItem ?? null,
    onFocusImageClick,
    scrollBottomInset,
    batchTools,
    onDownloadItem:
      onDownloadItem ??
      ((item: CanvasItem) => window.open(assetUrl(item.url), "_blank")),
    onShareItem,
    onPublishItem,
  };

  return {
    mobile,
    selectSourceBanner,
    showFailureBannerDismiss,
    onDismissJobFailure,
    focusClickActive,
    focusClickRequest,
    onFocusClickCancel,
    items,
    selectedId,
    onSelect,
    readOnly,
    scrollBottomInset,
    scrollCanvasRef,
    productGalleryProps,
    conversationPaneActive,
    conversationPaneWidth,
    onConversationPaneResizeStart,
    conversationPaneResizing,
    contextMenu,
    setContextMenu,
    onDownload,
    onCutoutItem,
    onDeleteSelected,
    selectionToolbar,
    statusChip,
    lightbox,
    setLightbox,
  };
}

export type DesignCanvasViewModel = ReturnType<typeof useDesignCanvas>;
