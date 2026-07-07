import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import type { CreationMode } from "@aimarket/ui";
import {
  ensureSession,
  exportSession,
  runTool,
  submitGeneration,
  trackEvent,
  uploadAsset,
  requestVideoBgmMux,
} from "@/lib/api-client";
import { assetUrl } from "@/lib/api-client";
import { resolveApiBase } from "@/lib/api-base";
import type { CanvasItem } from "@/lib/canvas-tools";
import {
  createUploadCanvasItem,
} from "@/lib/canvas-tools";
import { extractVideoLastFrame } from "@/lib/video-frame-extract";
import type { StudioMentionItemRequest } from "@/lib/canvas-node-handlers";
import { hapticLight } from "@/lib/haptics";

export interface UseStudioCanvasActionsParams {
  sessionId: string;
  mode: CreationMode;
  user: { id: string } | null;
  readOnly: boolean;
  canvasItems: CanvasItem[];
  canvasItemsRef: RefObject<CanvasItem[]>;
  selectedCanvasId: string | null;
  uploadRef: RefObject<HTMLInputElement | null>;
  bgmInputRef: RefObject<HTMLInputElement | null>;
  setCanvasItems: React.Dispatch<React.SetStateAction<CanvasItem[]>>;
  setSelectedCanvasId: (id: string | null) => void;
  setLoginOpen: (open: boolean) => void;
  setSelectSourceBanner: (message: string | null) => void;
  setMentionItemRequest: React.Dispatch<
    React.SetStateAction<StudioMentionItemRequest | null>
  >;
  setPollingJobId: (id: string | null) => void;
  registerToolBatchLineage: (
    jobId: string,
    item: CanvasItem,
    toolName?: string,
  ) => void;
}

export function useStudioCanvasActions({
  sessionId,
  mode,
  user,
  readOnly,
  canvasItems,
  canvasItemsRef,
  selectedCanvasId,
  uploadRef,
  bgmInputRef,
  setCanvasItems,
  setSelectedCanvasId,
  setLoginOpen,
  setSelectSourceBanner,
  setMentionItemRequest,
  setPollingJobId,
  registerToolBatchLineage,
}: UseStudioCanvasActionsParams) {
  const [videoActionBusy, setVideoActionBusy] = useState(false);
  const pendingBgmVideoRef = useRef<CanvasItem | null>(null);

  const handleCanvasDownload = useCallback(async () => {
    const selected = canvasItems.find((i) => i.id === selectedCanvasId);
    if (selected) {
      window.open(assetUrl(selected.url), "_blank");
      return;
    }
    if (!user) {
      setLoginOpen(true);
      return;
    }
    const data = await exportSession(sessionId);
    for (const f of data.files) {
      window.open(
        f.url.startsWith("http") ? f.url : `${resolveApiBase()}${f.url}`,
        "_blank",
      );
    }
    if (!data.files.length) setSelectSourceBanner("暂无可下载内容");
  }, [
    canvasItems,
    selectedCanvasId,
    user,
    sessionId,
    setLoginOpen,
    setSelectSourceBanner,
  ]);

  const handleCanvasUpload = useCallback(() => {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    if (readOnly) return;
    uploadRef.current?.click();
  }, [user, readOnly, uploadRef, setLoginOpen]);

  const onFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !user || readOnly) return;
      try {
        await ensureSession(sessionId, mode);
        const { id, url, thumbUrl } = await uploadAsset(file, sessionId);
        setCanvasItems((prev) => [
          ...prev,
          createUploadCanvasItem(url, prev, {
            assetId: id,
            role: "product",
            thumbUrl,
          }),
        ]);
        hapticLight();
      } catch (err) {
        setSelectSourceBanner(
          err instanceof Error ? err.message : "上传失败",
        );
      }
    },
    [
      user,
      readOnly,
      sessionId,
      mode,
      setCanvasItems,
      setSelectSourceBanner,
    ],
  );

  const handleUploadToCanvas = useCallback(
    (assetId: string, url: string, thumbUrl?: string) => {
      if (readOnly) return;
      setCanvasItems((prev) => [
        ...prev,
        createUploadCanvasItem(url, prev, { assetId, role: "product", thumbUrl }),
      ]);
      hapticLight();
    },
    [readOnly, setCanvasItems],
  );

  const handleDeleteCanvasItem = useCallback(() => {
    if (readOnly || !selectedCanvasId) return;
    setCanvasItems((prev) => prev.filter((i) => i.id !== selectedCanvasId));
    setSelectedCanvasId(null);
  }, [readOnly, selectedCanvasId, setCanvasItems, setSelectedCanvasId]);

  const handleRerun = useCallback(
    async (item: CanvasItem) => {
      if (!user) {
        setLoginOpen(true);
        return;
      }
      if (readOnly || !item.generationParams) {
        setSelectSourceBanner("此图片无法重跑：缺少原始生成参数");
        return;
      }

      const params = item.generationParams;
      setSelectSourceBanner("正在重跑任务...");

      try {
        let jobId: string;

        if (params.toolType) {
          const { jobId: id } = await runTool(params.toolType, {
            sessionId,
            prompt: params.prompt,
            resolution: params.resolution,
            referenceOutputIds: item.outputId ? [item.outputId] : undefined,
          });
          jobId = id;
          void trackEvent("tool_run", {
            tool_id: params.toolType,
            job_id: jobId,
            has_reference: Boolean(item.outputId),
          });
          registerToolBatchLineage(jobId, item, params.toolType);
        } else {
          const { jobId: id } = await submitGeneration({
            sessionId,
            prompt: params.prompt,
            modelId: params.modelId,
            count: params.count ?? 1,
            resolution: params.resolution ?? "standard",
            aspectRatio: params.aspectRatio,
            mode: params.toolType ? "chat" : mode,
          });
          jobId = id;
          void trackEvent("generation_rerun", {
            job_id: jobId,
            model_id: params.modelId ?? "unknown",
          });
        }

        setPollingJobId(jobId);
        setSelectSourceBanner(null);
      } catch (err) {
        setSelectSourceBanner(
          err instanceof Error ? err.message : "重跑失败",
        );
      }
    },
    [
      user,
      readOnly,
      sessionId,
      mode,
      setLoginOpen,
      setSelectSourceBanner,
      registerToolBatchLineage,
      setPollingJobId,
    ],
  );

  const handleExtractVideoLastFrame = useCallback(
    async (item: CanvasItem) => {
      if (!user) {
        setLoginOpen(true);
        return;
      }
      if (readOnly || !item.isVideo) return;
      setVideoActionBusy(true);
      setSelectSourceBanner("正在提取视频尾帧...");
      try {
        const blob = await extractVideoLastFrame(item.url);
        const file = new File([blob], `last-frame-${item.id.slice(0, 8)}.jpg`, {
          type: "image/jpeg",
        });
        await ensureSession(sessionId, mode);
        const { id, url, thumbUrl } = await uploadAsset(file, sessionId);
        const newItem = createUploadCanvasItem(url, canvasItemsRef.current, {
          assetId: id,
          role: "reference",
          label: "视频尾帧",
          thumbUrl,
        });
        setCanvasItems((prev) => [...prev, newItem]);
        setMentionItemRequest((prev) => ({
          key: (prev?.key ?? 0) + 1,
          item: newItem,
        }));
        setSelectSourceBanner("尾帧已提取并加入画布，已引用到工作台");
        hapticLight();
      } catch (err) {
        setSelectSourceBanner(
          err instanceof Error ? err.message : "尾帧提取失败",
        );
      } finally {
        setVideoActionBusy(false);
      }
    },
    [
      user,
      readOnly,
      sessionId,
      mode,
      canvasItemsRef,
      setCanvasItems,
      setMentionItemRequest,
      setLoginOpen,
      setSelectSourceBanner,
    ],
  );

  const handleAddVideoBgm = useCallback(
    (item: CanvasItem) => {
      if (!user) {
        setLoginOpen(true);
        return;
      }
      if (readOnly || !item.isVideo) return;
      pendingBgmVideoRef.current = item;
      bgmInputRef.current?.click();
    },
    [user, readOnly, bgmInputRef, setLoginOpen],
  );

  const onBgmFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      const item = pendingBgmVideoRef.current;
      pendingBgmVideoRef.current = null;
      if (!file || !item || !user) return;
      setVideoActionBusy(true);
      setSelectSourceBanner("正在上传音频...");
      try {
        await ensureSession(sessionId, mode);
        const { id } = await uploadAsset(file, sessionId);
        const { outputUrl, assetId } = await requestVideoBgmMux({
          sessionId,
          videoUrl: assetUrl(item.url),
          audioAssetId: id,
        });
        const muxedItem = {
          ...createUploadCanvasItem(outputUrl, canvasItemsRef.current, {
            assetId,
            role: "output" as const,
            label: "配乐视频",
          }),
          isVideo: true,
        };
        setCanvasItems((prev) => [...prev, muxedItem]);
        setSelectedCanvasId(muxedItem.id);
        setSelectSourceBanner("配乐视频已合成并加入画布");
        hapticLight();
      } catch (err) {
        setSelectSourceBanner(err instanceof Error ? err.message : "配乐失败");
      } finally {
        setVideoActionBusy(false);
      }
    },
    [
      user,
      sessionId,
      mode,
      canvasItemsRef,
      setCanvasItems,
      setSelectedCanvasId,
      setSelectSourceBanner,
    ],
  );

  return {
    videoActionBusy,
    handleCanvasDownload,
    handleCanvasUpload,
    onFileSelected,
    handleUploadToCanvas,
    handleDeleteCanvasItem,
    handleRerun,
    handleExtractVideoLastFrame,
    handleAddVideoBgm,
    onBgmFileSelected,
  };
}
