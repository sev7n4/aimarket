"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import {
  DramaCharacterCardShell,
  dramaCharacterDisplayFromCard,
} from "@/components/drama/drama-character-card-shell";
import { DramaVoicePicker } from "@/components/drama-voice-picker";
import { DramaAssetRegenPopover } from "@/components/drama/drama-asset-regen-popover";
import {
  fetchDramaProject,
  generateDramaCharacterTurnaround,
} from "@/lib/api-client";
import {
  CHARACTER_ANGLE_LABELS,
  characterRefImageUrl,
  characterTurnaroundRefsComplete,
} from "@/lib/drama-character-helpers";
import type { DramaCharacterCard, DramaProjectPayload } from "@/lib/types";

const ANGLES = ["front", "three_quarter", "side"] as const;

interface DramaCharacterCardViewProps {
  character: DramaCharacterCard;
  projectId: string;
  readOnly?: boolean;
  busy?: boolean;
  onProjectUpdate: (project: DramaProjectPayload) => void;
  onLockCharacter?: (
    characterId: string,
    status: "draft" | "locked",
  ) => Promise<void>;
  onVoiceChange?: (characterId: string, voiceId: string) => void;
  onVoiceRefine?: (characterId: string, instruction: string) => Promise<void>;
  onUploadRef?: () => void;
  uploadingRef?: boolean;
  genError?: string | null;
}

/** 角色卡 + 三视图定稿（PROD-A07 / A08） */
export function DramaCharacterCardView({
  character,
  projectId,
  readOnly,
  busy,
  onProjectUpdate,
  onLockCharacter,
  onVoiceChange,
  onVoiceRefine,
  onUploadRef,
  uploadingRef,
  genError,
}: DramaCharacterCardViewProps) {
  const [userGenerating, setUserGenerating] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [voiceRegenOpen, setVoiceRegenOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoGenTriggered = useRef(false);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refreshProject = useCallback(async () => {
    if (!projectId) return null as unknown as DramaProjectPayload;
    const next = await fetchDramaProject(projectId);
    onProjectUpdate(next.project);
    return next.project;
  }, [projectId, onProjectUpdate]);

  const locked = character.turnaroundStatus === "locked";
  const refsComplete = characterTurnaroundRefsComplete(character);
  const pending = character.turnaroundPending === true;
  const generating = pending || userGenerating;
  const displayError = genError ?? localError;

  useEffect(() => () => stopPoll(), [stopPoll]);

  useEffect(() => {
    if (readOnly || !projectId || refsComplete || !pending) return;
    const timer = setInterval(() => {
      void refreshProject().then((project) => {
        if (!project) return;
        const char = project.characters.find((c) => c.id === character.id);
        if (char && characterTurnaroundRefsComplete(char)) {
          setUserGenerating(false);
        }
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [readOnly, projectId, refsComplete, pending, refreshProject, character.id]);

  const handleGenerate = useCallback(
    async (options?: { force?: boolean; promptOverride?: string }) => {
      if (readOnly || busy || generating) return;
      setUserGenerating(true);
      setLocalError(null);
      try {
        const data = await generateDramaCharacterTurnaround(
          projectId,
          character.id,
          {
            force: options?.force ?? !refsComplete,
            promptOverride: options?.promptOverride,
          },
        );
        onProjectUpdate(data.project.project);

        stopPoll();
        pollRef.current = setInterval(() => {
          void refreshProject().then((project) => {
            const char = project.characters.find((c) => c.id === character.id);
            if (char && characterTurnaroundRefsComplete(char)) {
              stopPoll();
              setUserGenerating(false);
            }
          });
        }, 1500);
      } catch (err) {
        setUserGenerating(false);
        setLocalError(err instanceof Error ? err.message : "生成失败");
        stopPoll();
      }
    },
    [
      readOnly,
      busy,
      generating,
      refsComplete,
      projectId,
      character.id,
      onProjectUpdate,
      refreshProject,
      stopPoll,
    ],
  );

  useEffect(() => {
    if (
      autoGenTriggered.current ||
      readOnly ||
      !projectId ||
      refsComplete ||
      pending ||
      generating ||
      locked ||
      displayError
    ) {
      return;
    }
    autoGenTriggered.current = true;
    void handleGenerate();
  }, [
    readOnly,
    projectId,
    refsComplete,
    pending,
    generating,
    locked,
    displayError,
    handleGenerate,
  ]);

  const handleLock = useCallback(
    async (status: "draft" | "locked") => {
      if (readOnly || busy || !onLockCharacter) return;
      await onLockCharacter(character.id, status);
    },
    [readOnly, busy, onLockCharacter, character.id],
  );

  return (
    <>
      <DramaCharacterCardShell
        mode="panel"
        character={dramaCharacterDisplayFromCard(character, {
          generating,
          error: displayError,
          refsComplete,
          locked,
        })}
        testId={`drama-character-card-${character.id}`}
        className="rounded-lg border border-white/10 bg-black/20"
        footer={
          !readOnly ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || generating || locked}
                onClick={() => void handleGenerate({ force: refsComplete })}
                className="text-[10px] text-fuchsia-300 hover:text-fuchsia-200 disabled:opacity-50"
                data-testid="drama-character-turnaround-generate"
              >
                {generating ? "生成中…" : refsComplete ? "重新生成" : "生成三视图"}
              </button>
              {!readOnly ? (
                <button
                  type="button"
                  disabled={busy || generating || locked}
                  onClick={() => setRegenOpen(true)}
                  className="inline-flex items-center gap-0.5 text-[10px] text-violet-300 hover:text-violet-200 disabled:opacity-50"
                  data-testid="drama-character-turnaround-refine"
                >
                  <Sparkles className="size-3" />
                  提示词改图
                </button>
              ) : null}
              {onUploadRef ? (
                <button
                  type="button"
                  disabled={busy || generating || locked || uploadingRef}
                  onClick={onUploadRef}
                  className="text-[10px] text-fuchsia-300 hover:text-fuchsia-200 disabled:opacity-50"
                  data-testid="drama-character-upload-ref"
                >
                  {uploadingRef ? "上传中…" : "上传参考图"}
                </button>
              ) : null}
              {refsComplete && !locked ? (
                <button
                  type="button"
                  disabled={busy || generating}
                  onClick={() => void handleLock("locked")}
                  className="text-[10px] text-emerald-300 hover:text-emerald-200 disabled:opacity-50"
                  data-testid="drama-character-turnaround-lock"
                >
                  确认定稿
                </button>
              ) : null}
              {locked ? (
                <button
                  type="button"
                  disabled={busy || generating}
                  onClick={() => void handleLock("draft")}
                  className="text-[10px] text-zinc-400 hover:text-zinc-300 disabled:opacity-50"
                  data-testid="drama-character-turnaround-unlock"
                >
                  解锁重做
                </button>
              ) : null}
            </div>
          ) : null
        }
      >
        {onVoiceChange ? (
          <div className="space-y-1">
            <DramaVoicePicker
              value={character.voiceId}
              disabled={readOnly || busy || locked}
              onChange={(voiceId) => onVoiceChange(character.id, voiceId)}
            />
            {onVoiceRefine && !readOnly ? (
              <button
                type="button"
                disabled={busy || locked}
                onClick={() => setVoiceRegenOpen(true)}
                className="inline-flex items-center gap-0.5 text-[10px] text-violet-300 hover:text-violet-200 disabled:opacity-50"
                data-testid="drama-character-voice-refine"
              >
                <Sparkles className="size-3" />
                AI 推荐音色
              </button>
            ) : null}
          </div>
        ) : null}

        <div
          className="grid grid-cols-3 gap-1.5"
          data-testid="drama-character-turnaround-grid"
        >
          {ANGLES.map((angle) => {
            const url = characterRefImageUrl(character, angle);
            return (
              <div
                key={angle}
                className="overflow-hidden rounded border border-white/10 bg-black/30"
                data-testid={`drama-character-angle-${angle}`}
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={CHARACTER_ANGLE_LABELS[angle]}
                    className="aspect-[3/4] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[3/4] items-center justify-center text-[9px] text-zinc-600">
                    {generating ? "…" : CHARACTER_ANGLE_LABELS[angle]}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DramaCharacterCardShell>

      {!readOnly ? (
        <DramaAssetRegenPopover
          open={regenOpen}
          title={`迭代角色「${character.name}」`}
          placeholder="例如：更年轻、红色外套、短发…"
          busy={busy || generating}
          onClose={() => setRegenOpen(false)}
          onSubmit={async (instruction) => {
            await handleGenerate({ force: true, promptOverride: instruction });
          }}
        />
      ) : null}
      {onVoiceRefine && !readOnly ? (
        <DramaAssetRegenPopover
          open={voiceRegenOpen}
          title={`迭代音色「${character.name}」`}
          placeholder="例如：更成熟低沉、带一点沙哑、适合反派…"
          busy={busy}
          onClose={() => setVoiceRegenOpen(false)}
          onSubmit={async (instruction) => {
            await onVoiceRefine(character.id, instruction);
          }}
        />
      ) : null}
    </>
  );
}
