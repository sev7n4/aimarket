import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { DesignCanvasHandle } from "@/components/design-canvas";
import { assetUrl } from "@/lib/api/core";
import { recognizeFocusPoint, runTool } from "@/lib/api/generation";
import { trackEvent } from "@/lib/api/studio";
import type { CanvasItem } from "@/lib/canvas-tools";
import { pickLatestBatchFocusTarget } from "@/lib/canvas-tools";
import {
  DEFAULT_CROP_SIZE,
  MAX_FOCUS_POINTS,
  isFocusEditShortcut,
  focusEditShortcutLabel,
  type FocusEditSession,
  type FocusPointChip,
} from "@/lib/focus-edit";
import type { StudioMentionItemRequest } from "@/lib/canvas-node-handlers";
import { focusIndexLabel } from "@/lib/focus-index-labels";
import { resolveToolResolution } from "@/lib/tool-resolution";
import { hapticLight } from "@/lib/haptics";

const FOCUS_CLICK_DEBOUNCE_MS = 1500;

export interface UseStudioFocusEditParams {
  sessionId: string;
  user: { id: string } | null;
  readOnly: boolean;
  canvasItems: CanvasItem[];
  selectedCanvasItem: CanvasItem | null;
  setSelectSourceBanner: (message: string | null) => void;
  setMentionItemRequest: React.Dispatch<
    React.SetStateAction<StudioMentionItemRequest | null>
  >;
  setSelectedCanvasId: (id: string | null) => void;
  setDockMode: React.Dispatch<
    React.SetStateAction<import("@/lib/studio-dock-state").StudioDockMode>
  >;
  clearBrushRequest?: () => void;
  canvasRef: RefObject<DesignCanvasHandle | null>;
  registerToolBatchLineage: (
    jobId: string,
    item: CanvasItem,
    toolName?: string,
  ) => void;
  setPollingJobId: (id: string | null) => void;
}

export function useStudioFocusEdit({
  sessionId,
  user,
  readOnly,
  canvasItems,
  selectedCanvasItem,
  setSelectSourceBanner,
  setMentionItemRequest,
  setSelectedCanvasId,
  setDockMode,
  clearBrushRequest,
  canvasRef,
  registerToolBatchLineage,
  setPollingJobId,
}: UseStudioFocusEditParams) {
  const [focusEditSession, setFocusEditSession] =
    useState<FocusEditSession | null>(null);
  const [focusRecognizing, setFocusRecognizing] = useState(false);
  const [focusClickKey, setFocusClickKey] = useState(0);
  const lastFocusClickAtRef = useRef(0);

  useEffect(() => {
    if (!focusEditSession) return;
    setDockMode((prev) => (prev === "focus" ? "expanded" : prev));
  }, [focusEditSession, setDockMode]);

  const exitFocusEditMode = useCallback(() => {
    setFocusEditSession(null);
    setFocusRecognizing(false);
    setFocusClickKey((k) => k + 1);
  }, []);

  const startFocusEditMode = useCallback(
    (
      item: CanvasItem,
      opts?: { intent?: "edit" | "replace"; promptHint?: string },
    ) => {
      clearBrushRequest?.();
      setFocusEditSession({
        itemId: item.id,
        points: [],
        intent: opts?.intent ?? "edit",
        cropSize: DEFAULT_CROP_SIZE,
      });
      setFocusClickKey((k) => k + 1);
      setSelectedCanvasId(item.id);
      if (opts?.promptHint) {
        setMentionItemRequest((prev) => ({
          key: (prev?.key ?? 0) + 1,
          item,
          promptSuffix: opts.promptHint,
        }));
      }
      setSelectSourceBanner(
        `焦点编辑：在图片上点击要修改的位置，在工作站输入短 prompt 后提交（${focusEditShortcutLabel()} 开关）。`,
      );
      hapticLight();
    },
    [
      clearBrushRequest,
      setMentionItemRequest,
      setSelectSourceBanner,
      setSelectedCanvasId,
    ],
  );

  const handleFocusImageClick = useCallback(
    async (item: CanvasItem, point: { x: number; y: number }) => {
      if (
        !user ||
        readOnly ||
        !focusEditSession ||
        item.id !== focusEditSession.itemId
      ) {
        return;
      }
      const now = Date.now();
      if (now - lastFocusClickAtRef.current < FOCUS_CLICK_DEBOUNCE_MS) {
        setSelectSourceBanner("点击过快，请稍候再添加焦点");
        return;
      }
      lastFocusClickAtRef.current = now;
      if (focusEditSession.points.length >= MAX_FOCUS_POINTS) {
        setSelectSourceBanner(`最多添加 ${MAX_FOCUS_POINTS} 个焦点`);
        return;
      }
      setFocusRecognizing(true);
      try {
        const imageUrl = assetUrl(item.url);
        const data = await recognizeFocusPoint({
          sessionId,
          imageUrl,
          x: point.x,
          y: point.y,
          cropSize: focusEditSession.cropSize,
        });
        const chip: FocusPointChip = {
          pointId: data.pointId,
          objectName: data.objectName?.trim() || "目标区域",
          x: point.x,
          y: point.y,
          itemId: item.id,
        };
        setFocusEditSession((prev) =>
          prev && prev.itemId === item.id
            ? { ...prev, points: [...prev.points, chip] }
            : prev,
        );
        setSelectSourceBanner(null);
        hapticLight();
      } catch (err) {
        setSelectSourceBanner(
          err instanceof Error ? err.message : "焦点识别失败",
        );
      } finally {
        setFocusRecognizing(false);
      }
    },
    [user, readOnly, focusEditSession, sessionId, setSelectSourceBanner],
  );

  const focusClickRequest =
    focusEditSession
      ? {
          key: focusClickKey,
          itemId: focusEditSession.itemId,
          toolName: "焦点编辑",
          markers: focusEditSession.points.map((p) => ({
            x: p.x,
            y: p.y,
            label: p.objectName,
          })),
        }
      : null;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!isFocusEditShortcut(e)) return;
      e.preventDefault();
      if (readOnly || !user) return;
      const item =
        selectedCanvasItem ??
        (() => {
          const t = pickLatestBatchFocusTarget(canvasItems);
          return t ? canvasItems.find((i) => i.id === t.itemId) : null;
        })();
      if (!item?.outputId && !item?.assetId) {
        setSelectSourceBanner("请先在画布点选一张图片，再开启焦点编辑");
        return;
      }
      if (focusEditSession?.itemId === item.id) {
        exitFocusEditMode();
        setSelectSourceBanner(null);
      } else {
        startFocusEditMode(item);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    user,
    readOnly,
    selectedCanvasItem,
    canvasItems,
    focusEditSession?.itemId,
    exitFocusEditMode,
    startFocusEditMode,
    setSelectSourceBanner,
  ]);

  const focusEditDockProps = useMemo(
    () =>
      focusEditSession
        ? {
            points: focusEditSession.points,
            intent: focusEditSession.intent,
            cropSize: focusEditSession.cropSize,
            recognizing: focusRecognizing,
            onIntentChange: (intent: FocusEditSession["intent"]) =>
              setFocusEditSession((prev) =>
                prev ? { ...prev, intent } : prev,
              ),
            onRemovePoint: (pointId: string) =>
              setFocusEditSession((prev) =>
                prev
                  ? {
                      ...prev,
                      points: prev.points.filter((p) => p.pointId !== pointId),
                    }
                  : prev,
              ),
            onEditPoint: (pointId: string, newName: string) =>
              setFocusEditSession((prev) =>
                prev
                  ? {
                      ...prev,
                      points: prev.points.map((p) =>
                        p.pointId === pointId
                          ? { ...p, objectName: newName }
                          : p,
                      ),
                    }
                  : prev,
              ),
            onChipPromptChange: (pointId: string, chipPrompt: string) =>
              setFocusEditSession((prev) =>
                prev
                  ? {
                      ...prev,
                      points: prev.points.map((p) =>
                        p.pointId === pointId ? { ...p, chipPrompt } : p,
                      ),
                    }
                  : prev,
              ),
            onReplaceImage: (pointId: string, assetId: string, url: string) =>
              setFocusEditSession((prev) =>
                prev
                  ? {
                      ...prev,
                      points: prev.points.map((p) =>
                        p.pointId === pointId
                          ? {
                              ...p,
                              replaceAssetId: assetId,
                              replaceAssetUrl: url,
                            }
                          : p,
                      ),
                    }
                  : prev,
              ),
            onClearAll: () =>
              setFocusEditSession((prev) =>
                prev ? { ...prev, points: [] } : prev,
              ),
            onCropSizeChange: (size: number) =>
              setFocusEditSession((prev) =>
                prev ? { ...prev, cropSize: size } : prev,
              ),
            onCancel: exitFocusEditMode,
          }
        : null,
    [
      focusEditSession,
      focusRecognizing,
      exitFocusEditMode,
      setFocusEditSession,
    ],
  );

  const handleFocusEditSubmit = useCallback(
    async ({
      prompt,
      intent,
      points,
      item,
    }: {
      prompt: string;
      intent: FocusEditSession["intent"];
      points: FocusPointChip[];
      item: CanvasItem;
    }) => {
      const referenceOutputIds = item.outputId ? [item.outputId] : undefined;
      const replaceAssets = points
        .map((p) => p.replaceAssetId)
        .filter((id): id is string => Boolean(id));
      const assetIds = [
        ...(!referenceOutputIds && item.assetId ? [item.assetId] : []),
        ...replaceAssets,
      ];
      const chipLines = points
        .map((p, i) => {
          const chip = p.chipPrompt?.trim();
          if (!chip) return null;
          return `${focusIndexLabel(i)}${p.objectName}：${chip}`;
        })
        .filter((line): line is string => Boolean(line));
      const mergedPrompt = [chipLines.join("；"), prompt.trim()]
        .filter(Boolean)
        .join("\n");
      const { jobId } = await runTool("focus-edit", {
        sessionId,
        prompt: mergedPrompt || "按焦点区域进行局部编辑",
        referenceOutputIds,
        assetIds: assetIds.length ? assetIds : undefined,
        resolution: resolveToolResolution("focus-edit"),
        intent,
        focusPoints: points.map((p) => ({
          pointId: p.pointId,
          objectName: p.objectName,
          x: p.x,
          y: p.y,
        })),
      });
      void trackEvent("tool_run", {
        tool_id: "focus-edit",
        job_id: jobId,
        intent,
        focus_count: points.length,
      });
      registerToolBatchLineage(jobId, item, "焦点编辑");
      exitFocusEditMode();
      setPollingJobId(jobId);
      return jobId;
    },
    [
      sessionId,
      registerToolBatchLineage,
      exitFocusEditMode,
      canvasRef,
      setPollingJobId,
    ],
  );

  return {
    focusEditSession,
    setFocusEditSession,
    focusRecognizing,
    focusClickRequest,
    exitFocusEditMode,
    startFocusEditMode,
    handleFocusImageClick,
    focusEditDockProps,
    handleFocusEditSubmit,
  };
}
