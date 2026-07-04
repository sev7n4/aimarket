import { User } from "lucide-react";

import { DramaAssetCardShell } from "@/components/drama/drama-asset-card-shell";
import { DramaBadge } from "@/components/drama/drama-badge";
import { canvasTheme } from "../canvas-theme";
import type { CanvasNodeData } from "../types";

const roleLabels: Record<string, string> = {
  protagonist: "主角",
  supporting: "配角",
};

const turnaroundColors: Record<string, string> = {
  draft: "#eab308",
  locked: "#22c55e",
};

const turnaroundLabels: Record<string, string> = {
  draft: "草稿",
  locked: "已锁定",
};

type CharacterNodeContentProps = {
  node: CanvasNodeData;
};

export function CharacterNodeContent({ node }: CharacterNodeContentProps) {
  const m = node.metadata;
  const name = m?.characterName || node.title || "未命名角色";
  const role = m?.characterRole;
  const personalityTone = m?.personalityTone;
  const promptAnchor = m?.promptAnchor;
  const turnaroundStatus = m?.turnaroundStatus;
  const refUrl = m?.refUrl;

  const hero = refUrl ? (
    <img
      src={refUrl}
      alt={name}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      className="pointer-events-none size-full select-none object-cover object-top"
    />
  ) : (
    <div className="flex size-full flex-col items-center justify-center gap-1">
      <User
        className="size-10 opacity-20"
        style={{ color: canvasTheme.node.faint }}
      />
      <span
        className="text-[10px]"
        style={{ color: canvasTheme.node.faint }}
      >
        角色参考图
      </span>
    </div>
  );

  return (
    <DramaAssetCardShell
      category="character"
      compact
      hero={hero}
      heroAspect="portrait"
      testId="drama-canvas-character-card"
      badges={
        <>
          {role ? (
            <DramaBadge color="#d946ef">
              {roleLabels[role] || role}
            </DramaBadge>
          ) : null}
          {turnaroundStatus ? (
            <DramaBadge color={turnaroundColors[turnaroundStatus] || "#78716c"}>
              {turnaroundLabels[turnaroundStatus] || turnaroundStatus}
            </DramaBadge>
          ) : null}
        </>
      }
    >
      <div
        className="truncate text-sm font-bold leading-snug"
        style={{ color: canvasTheme.node.text }}
      >
        {name}
      </div>
      {personalityTone ? (
        <div
          className="line-clamp-1 text-xs leading-snug"
          style={{ color: canvasTheme.node.faint }}
        >
          {personalityTone}
        </div>
      ) : null}
      {promptAnchor ? (
        <div
          className="line-clamp-2 text-[11px] leading-snug"
          style={{ color: canvasTheme.node.faint }}
        >
          {promptAnchor}
        </div>
      ) : null}
    </DramaAssetCardShell>
  );
}
