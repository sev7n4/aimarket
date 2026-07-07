"use client";

import type { ReactNode } from "react";
import { User } from "lucide-react";

import { DramaAssetCardShell } from "@/components/drama/drama-asset-card-shell";
import { DramaBadge } from "@/components/drama/drama-badge";
import { canvasTheme } from "@/components/infinite-canvas/canvas-theme";
import type { CanvasNodeData } from "@/components/infinite-canvas/types";
import { characterRefImageUrl } from "@/lib/drama-character-helpers";
import type { DramaCharacterCard } from "@/lib/types";

const ROLE_LABELS: Record<string, string> = {
  protagonist: "主角",
  supporting: "配角",
};

const TURNAROUND_COLORS: Record<string, string> = {
  draft: "#eab308",
  locked: "#22c55e",
};

const TURNAROUND_LABELS: Record<string, string> = {
  draft: "草稿",
  locked: "已锁定",
};

export type DramaCharacterTurnaroundBadge = "draft" | "pending" | "locked";

export type DramaCharacterCardDisplay = {
  name: string;
  role?: string;
  personalityTone?: string;
  promptAnchor?: string;
  refUrl?: string | null;
  /** 画布节点 metadata.role */
  characterRole?: string;
  turnaroundStatus?: string;
  turnaroundBadge?: DramaCharacterTurnaroundBadge;
  ageRange?: string;
  hairStyle?: string;
  signatureOutfit?: string;
  voiceStyle?: string;
  generating?: boolean;
  error?: string | null;
};

export type DramaCharacterCardShellProps = {
  mode: "panel" | "node";
  character: DramaCharacterCardDisplay;
  testId?: string;
  className?: string;
  footer?: ReactNode;
  /** 面板业务区：音色选择、三视图网格等 */
  children?: ReactNode;
};

export function dramaCharacterDisplayFromCard(
  character: DramaCharacterCard,
  opts?: {
    generating?: boolean;
    error?: string | null;
    refsComplete?: boolean;
    locked?: boolean;
  },
): DramaCharacterCardDisplay {
  const vs = character.visualSignature;
  const locked = opts?.locked ?? character.turnaroundStatus === "locked";
  const refsComplete = opts?.refsComplete ?? false;
  let turnaroundBadge: DramaCharacterTurnaroundBadge = "draft";
  if (locked) turnaroundBadge = "locked";
  else if (refsComplete) turnaroundBadge = "pending";

  return {
    name: character.name,
    role: character.role,
    personalityTone: character.personalityTone,
    promptAnchor: character.promptAnchor,
    refUrl: characterRefImageUrl(character, "front"),
    turnaroundStatus: character.turnaroundStatus,
    turnaroundBadge,
    ageRange: vs.ageRange,
    hairStyle: vs.hairStyle,
    signatureOutfit: vs.signatureOutfit,
    voiceStyle: character.voiceStyle,
    generating: opts?.generating,
    error: opts?.error,
  };
}

export function dramaCharacterDisplayFromNode(
  node: CanvasNodeData,
): DramaCharacterCardDisplay {
  const m = node.metadata;
  return {
    name: m?.characterName || node.title || "未命名角色",
    characterRole: m?.characterRole,
    personalityTone: m?.personalityTone,
    promptAnchor: m?.promptAnchor,
    refUrl: m?.refUrl,
    turnaroundStatus: m?.turnaroundStatus,
  };
}

function panelTurnaroundBadge(badge: DramaCharacterTurnaroundBadge): ReactNode {
  const className =
    badge === "locked"
      ? "bg-emerald-500/15 text-emerald-300"
      : badge === "pending"
        ? "bg-amber-500/15 text-amber-300"
        : "bg-white/5 text-zinc-500";
  const label =
    badge === "locked" ? "已定稿" : badge === "pending" ? "待确认" : "草稿";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] ${className}`}
      data-testid="drama-character-turnaround-status"
    >
      {label}
    </span>
  );
}

function characterHeroPlaceholder(
  mode: "panel" | "node",
  character: DramaCharacterCardDisplay,
): ReactNode {
  if (mode === "node") {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-1">
        <User
          className="size-10 opacity-20"
          style={{ color: canvasTheme.node.faint }}
        />
        <span className="text-[10px]" style={{ color: canvasTheme.node.faint }}>
          角色参考图
        </span>
      </div>
    );
  }

  return (
    <div className="flex size-full flex-col items-center justify-center gap-1 text-zinc-600">
      <User className="size-8 opacity-40" />
      <span className="text-[10px]">
        {character.generating
          ? "生成中…"
          : character.error
            ? "生成失败"
            : "待生成三视图"}
      </span>
    </div>
  );
}

function characterBadges(
  mode: "panel" | "node",
  character: DramaCharacterCardDisplay,
): ReactNode {
  if (mode === "node") {
    const role = character.characterRole;
    const turnaroundStatus = character.turnaroundStatus;
    return (
      <>
        {role ? (
          <DramaBadge color="#d946ef">{ROLE_LABELS[role] || role}</DramaBadge>
        ) : null}
        {turnaroundStatus ? (
          <DramaBadge
            color={TURNAROUND_COLORS[turnaroundStatus] || "#78716c"}
          >
            {TURNAROUND_LABELS[turnaroundStatus] || turnaroundStatus}
          </DramaBadge>
        ) : null}
      </>
    );
  }

  return character.turnaroundBadge
    ? panelTurnaroundBadge(character.turnaroundBadge)
    : null;
}

function panelReadonlyBody(character: DramaCharacterCardDisplay): ReactNode {
  return (
    <>
      <div>
        <div className="font-semibold text-zinc-100">{character.name}</div>
        {character.role ? (
          <div className="text-[10px] text-zinc-500">{character.role}</div>
        ) : null}
        {character.personalityTone ? (
          <div className="mt-0.5 text-zinc-500">{character.personalityTone}</div>
        ) : null}
      </div>

      {character.promptAnchor ? (
        <p className="line-clamp-2 text-[10px] leading-relaxed text-zinc-500">
          {character.promptAnchor}
        </p>
      ) : null}

      {character.ageRange || character.hairStyle || character.signatureOutfit ? (
        <div className="flex flex-wrap gap-1 text-[10px] text-zinc-600">
          {character.ageRange ? <span>{character.ageRange}</span> : null}
          {character.ageRange && character.hairStyle ? <span>·</span> : null}
          {character.hairStyle ? <span>{character.hairStyle}</span> : null}
          {(character.ageRange || character.hairStyle) &&
          character.signatureOutfit ? (
            <span>·</span>
          ) : null}
          {character.signatureOutfit ? (
            <span>{character.signatureOutfit}</span>
          ) : null}
        </div>
      ) : null}

      {character.voiceStyle ? (
        <p className="text-[10px] text-violet-300/80">
          音色：{character.voiceStyle}
        </p>
      ) : null}

      {character.error ? (
        <p className="text-[10px] text-red-400/90">{character.error}</p>
      ) : null}
    </>
  );
}

function nodeBody(character: DramaCharacterCardDisplay): ReactNode {
  return (
    <>
      <div
        className="truncate text-sm font-bold leading-snug"
        style={{ color: canvasTheme.node.text }}
      >
        {character.name}
      </div>
      {character.personalityTone ? (
        <div
          className="line-clamp-1 text-xs leading-snug"
          style={{ color: canvasTheme.node.faint }}
        >
          {character.personalityTone}
        </div>
      ) : null}
      {character.promptAnchor ? (
        <div
          className="line-clamp-2 text-[11px] leading-snug"
          style={{ color: canvasTheme.node.faint }}
        >
          {character.promptAnchor}
        </div>
      ) : null}
    </>
  );
}

export function DramaCharacterCardShell({
  mode,
  character,
  testId,
  className,
  footer,
  children,
}: DramaCharacterCardShellProps) {
  const compact = mode === "node";
  const hero = character.refUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={character.refUrl}
      alt={character.name}
      draggable={compact ? false : undefined}
      onDragStart={compact ? (e) => e.preventDefault() : undefined}
      className={
        compact
          ? "pointer-events-none size-full select-none object-cover object-top"
          : "size-full object-cover object-top"
      }
    />
  ) : (
    characterHeroPlaceholder(mode, character)
  );

  return (
    <DramaAssetCardShell
      category="character"
      compact={compact}
      hero={hero}
      heroAspect="portrait"
      testId={testId}
      className={className}
      badges={characterBadges(mode, character)}
      footer={footer}
    >
      {mode === "node" ? nodeBody(character) : panelReadonlyBody(character)}
      {mode === "panel" ? children : null}
    </DramaAssetCardShell>
  );
}
