"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useState } from "react";

import type { AspectRatio } from "@/components/generation-settings-popover";
import { AUTO_MODEL_ID } from "@/components/model-picker";
import { normalizeLaneModelId } from "@/lib/creation-lane-drafts";
import { normalizeDockSkillId } from "@/components/creation-dock-controls";
import {
  persistCreationLane,
  type CreationDockScope,
  type CreationLane,
  type OutputPreferenceMode,
} from "@/lib/creation-dock-prefs";
import { isInternalRoutingModelId } from "@/lib/format-generation-display";
import { hasReferenceImages, type ReferenceImageSources } from "@/lib/creation-lane-submit";
import type { StudioInspirationApply } from "@/lib/inspiration-studio";
import type { ImageModel } from "@/lib/types";
import type { CreationMode } from "@aimarket/ui";
import type { UploadPreviewItem } from "@/components/upload-preview-stack";
import type { CanvasMaskSelection } from "@/lib/canvas-tools";
import type { FocusPointChip } from "@/lib/focus-edit";
import type { FocusEditIntent } from "@/lib/focus-edit";
import { renderInspiration } from "@/lib/api/inspiration";

const ASPECT_RATIOS: AspectRatio[] = [
  "1:1",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
  "3:2",
  "2:3",
  "4:5",
  "5:4",
  "21:9",
];

function coerceAspectRatio(value: string): AspectRatio {
  if (value === "auto" || !value) return "1:1";
  return ASPECT_RATIOS.includes(value as AspectRatio)
    ? (value as AspectRatio)
    : "1:1";
}

export type UseCreationPanelDockInput = {
  isDock: boolean;
  isStudioDock: boolean;
  dockLineOnly?: boolean;
  initialDockExpanded?: boolean;
  collapsed?: boolean;
  effectiveMode: CreationMode;
  creationLane: CreationLane;
  setCreationLane: (
    lane: CreationLane,
    settings?: Partial<{
      modelId: string;
      aspectRatio: AspectRatio;
      resolution: string;
    }>,
  ) => void;
  outputPrefMode: OutputPreferenceMode;
  setOutputPrefMode: (mode: OutputPreferenceMode) => void;
  modelId: string;
  setModelId: (id: string) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  models: ImageModel[];
  prompt: string;
  setPrompt: (p: string | ((prev: string) => string)) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onInteractionHint?: (hint: string) => void;
  buildReferenceSources: () => ReferenceImageSources;
  setDockSkillId: (id: string | null) => void;
  setSelectedSkillId: (id: string | null) => void;
  uploadPreviews: UploadPreviewItem[];
  selectedRefs: unknown[];
  mentionedAssetIds: string[];
  mentionedMasks: CanvasMaskSelection[];
  canvasReferenceActive: boolean;
  focusEdit?: {
    points: FocusPointChip[];
    intent: FocusEditIntent;
  } | null;
  creationDockScope: CreationDockScope;
  inspirationApply?: StudioInspirationApply | null;
  patchSettings: (settings: Partial<{
    modelId: string;
    aspectRatio: AspectRatio;
    resolution: string;
  }>) => void;
  setUploadPreviews: (items: UploadPreviewItem[]) => void;
  setAssetIds: (ids: string[]) => void;
  inspirationVars: Record<string, string>;
  setInspirationVars: (vars: Record<string, string>) => void;
};

export function useCreationPanelDock(input: UseCreationPanelDockInput) {
  const {
    isDock,
    isStudioDock,
    dockLineOnly,
    initialDockExpanded,
    collapsed,
    effectiveMode,
    creationLane,
    setCreationLane,
    outputPrefMode,
    setOutputPrefMode,
    modelId,
    setModelId,
    setAspectRatio,
    models,
    prompt,
    setPrompt,
    textareaRef,
    onInteractionHint,
    buildReferenceSources,
    setDockSkillId,
    setSelectedSkillId,
    uploadPreviews,
    selectedRefs,
    mentionedAssetIds,
    mentionedMasks,
    canvasReferenceActive,
    focusEdit,
    creationDockScope,
    inspirationApply,
    patchSettings,
    setUploadPreviews,
    setAssetIds,
    inspirationVars,
    setInspirationVars,
  } = input;

  const [dockExpanded, setDockExpanded] = useState(
    () => Boolean(initialDockExpanded) && !dockLineOnly,
  );
  const [dockFocused, setDockFocused] = useState(false);

  const handleCreationLaneChange = useCallback(
    (lane: CreationLane) => {
      const refSources = buildReferenceSources();
      if (lane === "agent" && hasReferenceImages(refSources)) {
        onInteractionHint?.("Agent 模式暂不支持参考图，已切换到图片生成");
        lane = "image";
      }
      setCreationLane(lane);
      if (lane !== "agent") {
        setDockSkillId(null);
        setSelectedSkillId(null);
      }
    },
    [
      buildReferenceSources,
      onInteractionHint,
      setCreationLane,
      setDockSkillId,
      setSelectedSkillId,
    ],
  );

  const handleOutputPrefModeChange = useCallback(
    (mode: OutputPreferenceMode) => {
      setOutputPrefMode(mode);
      if (mode === "auto") {
        setModelId(AUTO_MODEL_ID);
        setAspectRatio("auto");
      }
    },
    [setOutputPrefMode, setModelId, setAspectRatio],
  );

  const handleDockSkillChange = useCallback(
    (id: string | null) => {
      const normalized = normalizeDockSkillId(id);
      setDockSkillId(normalized);
      if (normalized) {
        setCreationLane("agent");
        setSelectedSkillId(normalized);
        return;
      }
      setSelectedSkillId(null);
    },
    [setDockSkillId, setCreationLane, setSelectedSkillId],
  );

  useEffect(() => {
    if (!isDock || outputPrefMode !== "auto") return;
    if (creationLane === "video") {
      const vm = models.find((m) => m.type === "video");
      if (vm) setModelId(vm.id);
    } else {
      setModelId(AUTO_MODEL_ID);
      setAspectRatio("auto");
    }
  }, [isDock, outputPrefMode, creationLane, models, setModelId, setAspectRatio]);

  useEffect(() => {
    if (!isDock || models.length === 0) return;
    if (modelId === AUTO_MODEL_ID || isInternalRoutingModelId(modelId)) {
      if (modelId !== AUTO_MODEL_ID) setModelId(AUTO_MODEL_ID);
      return;
    }
    const laneModels =
      creationLane === "video"
        ? models.filter((m) => m.type === "video")
        : models.filter((m) => m.type === "image");
    if (laneModels.length > 0 && !laneModels.some((m) => m.id === modelId)) {
      setModelId(AUTO_MODEL_ID);
    }
  }, [isDock, models, modelId, creationLane, setModelId]);

  useEffect(() => {
    if (!isDock) return;
    if (dockLineOnly) {
      setDockExpanded(false);
      setDockFocused(false);
    } else if (initialDockExpanded) {
      setDockExpanded(true);
    }
  }, [dockLineOnly, initialDockExpanded, isDock]);

  useEffect(() => {
    if (!isDock) return;
    function onDockExpand(event: Event) {
      const detail = (event as CustomEvent<{ expanded?: boolean }>).detail;
      setDockExpanded(detail?.expanded ?? true);
    }
    window.addEventListener("aimarket:creation-dock-expand", onDockExpand);
    return () =>
      window.removeEventListener("aimarket:creation-dock-expand", onDockExpand);
  }, [isDock]);

  useEffect(() => {
    if (!isDock) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    const expand = () => {
      setDockFocused(true);
      setDockExpanded(true);
    };
    textarea.addEventListener("focus", expand);
    textarea.addEventListener("pointerdown", expand);
    return () => {
      textarea.removeEventListener("focus", expand);
      textarea.removeEventListener("pointerdown", expand);
    };
  }, [isDock, textareaRef]);

  useEffect(() => {
    if (!inspirationApply) return;
    setPrompt(inspirationApply.prompt);
    const inspirationSettings = {
      modelId: normalizeLaneModelId(inspirationApply.modelId),
      aspectRatio: coerceAspectRatio(inspirationApply.aspectRatio),
      resolution: inspirationApply.resolution,
    };
    if (isStudioDock) {
      setCreationLane(inspirationApply.creationLane, inspirationSettings);
      persistCreationLane("studio", inspirationApply.creationLane);
    } else {
      patchSettings(inspirationSettings);
    }
    const vars: Record<string, string> = {};
    for (const v of inspirationApply.variables ?? []) {
      vars[v.key] = inspirationApply.variableValues[v.key] ?? v.default;
    }
    setInspirationVars(vars);
    if (inspirationApply.referenceUrls.length > 0) {
      setUploadPreviews(
        inspirationApply.referenceUrls.map((url, i) => ({
          id: `insp-${inspirationApply.applyKey}-${i}`,
          url,
        })),
      );
      setAssetIds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspirationApply?.applyKey]);

  useEffect(() => {
    if (!inspirationApply?.id || !Object.keys(inspirationVars).length) return;
    const t = setTimeout(() => {
      void renderInspiration(inspirationApply.id, inspirationVars)
        .then((data) => setPrompt(data.prompt))
        .catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [inspirationApply?.id, inspirationVars, setPrompt]);

  const effectiveCollapsed = isStudioDock ? false : Boolean(collapsed);
  const promptNeedsExpandedDock = prompt.includes("\n") || prompt.length > 72;
  const dockShouldExpand =
    !isDock ||
    effectiveCollapsed ||
    dockFocused ||
    dockExpanded ||
    promptNeedsExpandedDock ||
    uploadPreviews.length > 0 ||
    selectedRefs.length > 0 ||
    mentionedAssetIds.length > 0 ||
    mentionedMasks.length > 0 ||
    canvasReferenceActive ||
    Boolean(focusEdit);
  const dockCompactLine =
    isDock &&
    (dockLineOnly
      ? !dockFocused &&
        !dockExpanded &&
        !promptNeedsExpandedDock &&
        uploadPreviews.length === 0 &&
        selectedRefs.length === 0 &&
        mentionedAssetIds.length === 0 &&
        mentionedMasks.length === 0 &&
        !canvasReferenceActive &&
        !focusEdit
      : !dockShouldExpand);
  const dockIconBtn =
    "flex shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200";
  const dockIconBtnClass = isDock
    ? `${dockIconBtn} size-8`
    : "flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10";
  const dockIconBtnClassSm = isDock
    ? `${dockIconBtn} size-8`
    : "flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10";
  const showStackUpload = effectiveMode !== "ecommerce";
  const showInlineUploadStack =
    showStackUpload && !dockCompactLine && creationLane !== "video";

  return {
    dockExpanded,
    setDockExpanded,
    dockFocused,
    setDockFocused,
    handleCreationLaneChange,
    handleOutputPrefModeChange,
    handleDockSkillChange,
    effectiveCollapsed,
    dockShouldExpand,
    dockCompactLine,
    dockIconBtnClass,
    dockIconBtnClassSm,
    showStackUpload,
    showInlineUploadStack,
  };
}
