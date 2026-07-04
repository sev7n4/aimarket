"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { User } from "lucide-react";

import { DramaAssetCardShell } from "@/components/drama/drama-asset-card-shell";
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
  onUploadRef?: () => void;
  uploadingRef?: boolean;
}

/** 角色卡 + 三视图定稿（PROD-A07 / A08） */
export function DramaCharacterCardView({
  character,
  projectId,
  readOnly,
  busy,
  onProjectUpdate,
  onLockCharacter,
  onUploadRef,
  uploadingRef,
}: DramaCharacterCardViewProps) {
  const [generating, setGenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refreshProject = useCallback(async () => {
    const next = await fetchDramaProject(projectId);
    onProjectUpdate(next.project);
    return next.project;
  }, [projectId, onProjectUpdate]);

  useEffect(() => () => stopPoll(), [stopPoll]);

  const handleGenerate = useCallback(async () => {
    if (readOnly || busy || generating) return;
    setGenerating(true);
    try {
      const data = await generateDramaCharacterTurnaround(
        projectId,
        character.id,
      );
      onProjectUpdate(data.project.project);

      stopPoll();
      pollRef.current = setInterval(() => {
        void refreshProject().then((project) => {
          const char = project.characters.find((c) => c.id === character.id);
          if (char && characterTurnaroundRefsComplete(char)) {
            stopPoll();
            setGenerating(false);
          }
        });
      }, 1500);
    } catch {
      setGenerating(false);
      stopPoll();
    }
  }, [
    readOnly,
    busy,
    generating,
    projectId,
    character.id,
    onProjectUpdate,
    refreshProject,
    stopPoll,
  ]);

  const handleLock = useCallback(
    async (status: "draft" | "locked") => {
      if (readOnly || busy || !onLockCharacter) return;
      await onLockCharacter(character.id, status);
    },
    [readOnly, busy, onLockCharacter, character.id],
  );

  const locked = character.turnaroundStatus === "locked";
  const refsComplete = characterTurnaroundRefsComplete(character);
  const vs = character.visualSignature;
  const frontUrl = characterRefImageUrl(character, "front");

  const hero = frontUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={frontUrl}
      alt={character.name}
      className="size-full object-cover object-top"
    />
  ) : (
    <div className="flex size-full flex-col items-center justify-center gap-1 text-zinc-600">
      <User className="size-8 opacity-40" />
      <span className="text-[10px]">待生成三视图</span>
    </div>
  );

  return (
    <DramaAssetCardShell
      category="character"
      hero={hero}
      heroAspect="portrait"
      testId={`drama-character-card-${character.id}`}
      className="rounded-lg border border-white/10 bg-black/20"
      badges={
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] ${
            locked
              ? "bg-emerald-500/15 text-emerald-300"
              : refsComplete
                ? "bg-amber-500/15 text-amber-300"
                : "bg-white/5 text-zinc-500"
          }`}
          data-testid="drama-character-turnaround-status"
        >
          {locked ? "已定稿" : refsComplete ? "待确认" : "草稿"}
        </span>
      }
      footer={
        !readOnly ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || generating || locked}
              onClick={() => void handleGenerate()}
              className="text-[10px] text-fuchsia-300 hover:text-fuchsia-200 disabled:opacity-50"
              data-testid="drama-character-turnaround-generate"
            >
              {generating ? "生成中…" : "生成三视图"}
            </button>
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
      <div>
        <div className="font-semibold text-zinc-100">{character.name}</div>
        {character.role ? (
          <div className="text-[10px] text-zinc-500">{character.role}</div>
        ) : null}
        <div className="mt-0.5 text-zinc-500">{character.personalityTone}</div>
      </div>

      <p className="line-clamp-2 text-[10px] leading-relaxed text-zinc-500">
        {character.promptAnchor}
      </p>

      <div className="flex flex-wrap gap-1 text-[10px] text-zinc-600">
        <span>{vs.ageRange}</span>
        <span>·</span>
        <span>{vs.hairStyle}</span>
        <span>·</span>
        <span>{vs.signatureOutfit}</span>
      </div>

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
                  {CHARACTER_ANGLE_LABELS[angle]}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </DramaAssetCardShell>
  );
}
