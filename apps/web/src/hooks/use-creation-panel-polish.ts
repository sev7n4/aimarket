"use client";

import type { CreationMode } from "@aimarket/ui";
import { useCallback, useState } from "react";

import type { AspectRatio } from "@/components/generation-settings-popover";
import { AUTO_MODEL_ID } from "@/components/model-picker";
import type { ReferenceChipItem } from "@/components/reference-chips";
import type { CanvasItem, CanvasMaskSelection } from "@/lib/canvas-tools";
import type { CreationLane } from "@/lib/creation-dock-prefs";
import { getToken } from "@/lib/api/core";
import { optimizePromptApi } from "@/lib/api/generation";
import { resolveIntent } from "@/lib/intent-router";
import { polishPrompt } from "@/lib/prompt-polish";
import { readRecentAcceptedPrompts } from "@/lib/prompt-style-profile";
import { toApiCreationMode } from "@/lib/modes";

export type UseCreationPanelPolishInput = {
  prompt: string;
  setPrompt: (p: string | ((prev: string) => string)) => void;
  user: { id: string } | null;
  effectiveMode: CreationMode;
  creationLane: CreationLane;
  activeSkillId: string | null;
  focusEdit: { points: unknown[] } | null;
  mentionedMasks: CanvasMaskSelection[];
  submitVideo: boolean;
  referenceChips: ReferenceChipItem[];
  assetIds: string[];
  selectedRefs: { id: string }[];
  mentionedAssetIds: string[];
  selectedCanvasItem: CanvasItem | null | undefined;
  skillsEnabled: boolean;
  agentEnabled: boolean;
  isDock: boolean;
  modelId: string;
  aspectRatio: AspectRatio;
};

function sourceLabel(source: "template-mock" | "openai" | "dashscope"): string {
  if (source === "dashscope") return "百炼";
  if (source === "openai") return "OpenAI";
  return "模板";
}

function composeHint(
  source: "template-mock" | "openai" | "dashscope",
  directionLabel?: string,
): string {
  return directionLabel
    ? `${sourceLabel(source)} · ${directionLabel}`
    : sourceLabel(source);
}

export function useCreationPanelPolish(input: UseCreationPanelPolishInput) {
  const {
    prompt,
    setPrompt,
    user,
    effectiveMode,
    creationLane,
    activeSkillId,
    focusEdit,
    mentionedMasks,
    submitVideo,
    referenceChips,
    assetIds,
    selectedRefs,
    mentionedAssetIds,
    selectedCanvasItem,
    skillsEnabled,
    agentEnabled,
    isDock,
    modelId,
    aspectRatio,
  } = input;

  const [polishBusy, setPolishBusy] = useState(false);
  const [polishHint, setPolishHint] = useState<string | null>(null);
  const [polishCandidates, setPolishCandidates] = useState<string[]>([]);
  const [polishCandidateIndex, setPolishCandidateIndex] = useState(0);

  const handlePolish = useCallback(() => {
    const raw = prompt.trim();
    if (!raw || polishBusy) return;
    const polishApiMode = toApiCreationMode(effectiveMode);
    const hasRefs =
      referenceChips.length > 0 ||
      assetIds.length > 0 ||
      selectedRefs.length > 0 ||
      mentionedAssetIds.length > 0;
    const intent = resolveIntent({
      prompt: raw,
      creationLane,
      activeSkillId,
      focusEditActive: Boolean(focusEdit?.points.length),
      mentionedMasksCount: mentionedMasks.length,
      submitVideo,
      hasReferenceImages: hasRefs,
      hasSelectedCanvasItem: Boolean(selectedCanvasItem),
      skillsEnabled,
      agentEnabled,
      isDock,
    });
    setPolishCandidates([]);
    setPolishCandidateIndex(0);
    if (!user || !getToken()) {
      setPrompt(polishPrompt(polishApiMode, raw));
      setPolishHint(composeHint("template-mock"));
      return;
    }
    setPolishBusy(true);
    void optimizePromptApi(raw, polishApiMode, {
      context: {
        modelId: modelId === AUTO_MODEL_ID ? undefined : modelId,
        aspectRatio,
        hasReferenceImages: hasRefs,
        creationLane,
        intentSignal: intent.primarySignal,
        intentConfidence: intent.confidence,
        recentAccepted: readRecentAcceptedPrompts(3),
      },
    })
      .then((res) => {
        const candidates = [res.prompt, ...(res.variants ?? [])];
        setPrompt(res.prompt);
        setPolishCandidates(candidates);
        setPolishCandidateIndex(0);
        setPolishHint(composeHint(res.source, res.directionLabel));
      })
      .catch(() => {
        setPrompt(polishPrompt(polishApiMode, raw));
        setPolishHint(composeHint("template-mock"));
      })
      .finally(() => setPolishBusy(false));
  }, [
    prompt,
    polishBusy,
    effectiveMode,
    referenceChips.length,
    assetIds.length,
    selectedRefs.length,
    mentionedAssetIds.length,
    creationLane,
    activeSkillId,
    focusEdit?.points.length,
    mentionedMasks.length,
    submitVideo,
    selectedCanvasItem,
    skillsEnabled,
    agentEnabled,
    isDock,
    user,
    modelId,
    aspectRatio,
    setPrompt,
  ]);

  const cyclePolishCandidate = useCallback(() => {
    if (polishCandidates.length <= 1) return;
    const next = (polishCandidateIndex + 1) % polishCandidates.length;
    setPolishCandidateIndex(next);
    setPrompt(polishCandidates[next]);
  }, [polishCandidateIndex, polishCandidates, setPrompt]);

  const resetPolish = useCallback(() => {
    setPolishCandidates([]);
    setPolishCandidateIndex(0);
    setPolishHint(null);
  }, []);

  return {
    polishBusy,
    polishHint,
    polishCandidates,
    polishCandidateIndex,
    handlePolish,
    cyclePolishCandidate,
    resetPolish,
  };
}
