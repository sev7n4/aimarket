"use client";

import React from "react";
import { X, FileText, Clapperboard, User, MapPin, Clock, Camera } from "lucide-react";

import { CanvasNodeType, type CanvasNodeData } from "../types";
import { canvasTheme } from "../canvas-theme";
import { cn } from "@aimarket/ui";
import { DramaNodeChat } from "./DramaNodeChat";

// ── Shared label/value row ──

function FieldRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium" style={{ color: canvasTheme.node.faint }}>
        {label}
      </span>
      <span
        className={cn("text-xs leading-relaxed", mono && "font-mono text-[11px]")}
        style={{ color: canvasTheme.node.muted }}
      >
        {value}
      </span>
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
      style={{ background: `${color}22`, color }}
    >
      {children}
    </span>
  );
}

const shotStatusColors: Record<string, string> = {
  pending: "#78716c",
  keyframe: "#3b82f6",
  video: "#f97316",
  audio: "#a855f7",
  done: "#22c55e",
  failed: "#ef4444",
};

const shotStatusLabels: Record<string, string> = {
  pending: "待处理",
  keyframe: "关键帧",
  video: "视频中",
  audio: "音频中",
  done: "已完成",
  failed: "失败",
};

// ── Sub-panels per node type ──

function ScriptPanel({ node }: { node: CanvasNodeData }) {
  const m = node.metadata;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <FileText className="size-4" style={{ color: "#8b5cf6" }} />
        <span className="text-sm font-bold" style={{ color: canvasTheme.node.text }}>
          {m?.scriptTitle || node.title}
        </span>
      </div>
      {m?.logline && <FieldRow label="梗概" value={m.logline} />}
      {m?.actCount != null && <FieldRow label="幕数" value={`${m.actCount}`} />}
      {m?.narratorLineCount != null && <FieldRow label="旁白行数" value={`${m.narratorLineCount}`} />}
    </div>
  );
}

function ShotPanel({ node }: { node: CanvasNodeData }) {
  const m = node.metadata;
  const keyframeSrc = m?.content || (m?.keyframeOutputId ? `/outputs/${m.keyframeOutputId}` : null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clapperboard className="size-4" style={{ color: "#6366f1" }} />
          <span className="text-sm font-bold" style={{ color: canvasTheme.node.text }}>
            分镜 #{m?.shotOrder ?? "?"}
          </span>
        </div>
        {m?.shotStatus && (
          <Badge color={shotStatusColors[m.shotStatus] || "#78716c"}>
            {shotStatusLabels[m.shotStatus] || m.shotStatus}
          </Badge>
        )}
      </div>

      {keyframeSrc && (
        <div className="overflow-hidden rounded-lg" style={{ background: canvasTheme.node.panel }}>
          <img
            src={keyframeSrc}
            alt={`分镜 #${m?.shotOrder}`}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            className="pointer-events-none w-full select-none object-cover"
          />
        </div>
      )}

      {m?.dialogue && <FieldRow label="对白" value={m.dialogue} />}
      {m?.visualPrompt && <FieldRow label="视觉提示" value={m.visualPrompt} mono />}
      {m?.motionPrompt && <FieldRow label="运动提示" value={m.motionPrompt} mono />}

      {(m?.cameraShotSize || m?.cameraMovement || m?.cameraLighting) && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium" style={{ color: canvasTheme.node.faint }}>
            <Camera className="mr-1 inline size-3" />
            镜头规格
          </span>
          <div className="flex flex-wrap gap-1.5">
            {m?.cameraShotSize && <Badge color="#3b82f6">{m.cameraShotSize}</Badge>}
            {m?.cameraMovement && <Badge color="#0ea5e9">{m.cameraMovement}</Badge>}
            {m?.cameraLighting && <Badge color="#eab308">{m.cameraLighting}</Badge>}
          </div>
        </div>
      )}

      {m?.durationSec != null && (
        <div className="flex items-center gap-1.5">
          <Clock className="size-3" style={{ color: canvasTheme.node.faint }} />
          <span className="text-xs" style={{ color: canvasTheme.node.muted }}>
            {m.durationSec}s
          </span>
        </div>
      )}

      {m?.sceneId && <FieldRow label="场景 ID" value={m.sceneId} mono />}
      {m?.characterIds && m.characterIds.length > 0 && (
        <FieldRow label="角色" value={m.characterIds.join(", ")} />
      )}
    </div>
  );
}

function CharacterPanel({ node }: { node: CanvasNodeData }) {
  const m = node.metadata;
  const refUrl = m?.refUrl;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <User className="size-4" style={{ color: "#8b5cf6" }} />
        <span className="text-sm font-bold" style={{ color: canvasTheme.node.text }}>
          {m?.characterName || node.title}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {m?.characterRole && <Badge color="#8b5cf6">{m.characterRole}</Badge>}
        {m?.turnaroundStatus && (
          <Badge color={m.turnaroundStatus === "locked" ? "#22c55e" : "#eab308"}>
            {m.turnaroundStatus === "locked" ? "已锁定" : "草稿"}
          </Badge>
        )}
      </div>

      {m?.personalityTone && <FieldRow label="性格基调" value={m.personalityTone} />}
      {m?.promptAnchor && <FieldRow label="提示锚点" value={m.promptAnchor} mono />}

      {refUrl && (
        <div className="overflow-hidden rounded-lg" style={{ background: canvasTheme.node.panel }}>
          <img
            src={refUrl}
            alt={m?.characterName || "角色"}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            className="pointer-events-none w-full select-none object-cover"
          />
        </div>
      )}
    </div>
  );
}

function ScenePanel({ node }: { node: CanvasNodeData }) {
  const m = node.metadata;
  const sceneRefUrl = m?.sceneRefUrl;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MapPin className="size-4" style={{ color: "#0ea5e9" }} />
        <span className="text-sm font-bold" style={{ color: canvasTheme.node.text }}>
          {m?.sceneName || node.title}
        </span>
      </div>

      {m?.location && <FieldRow label="地点" value={m.location} />}
      {m?.atmosphere && <FieldRow label="氛围" value={m.atmosphere} />}
      {m?.era && <FieldRow label="时代" value={m.era} />}
      {m?.scenePromptAnchor && <FieldRow label="提示锚点" value={m.scenePromptAnchor} mono />}

      {sceneRefUrl && (
        <div className="overflow-hidden rounded-lg" style={{ background: canvasTheme.node.panel }}>
          <img
            src={sceneRefUrl}
            alt={m?.sceneName || "场景"}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            className="pointer-events-none w-full select-none object-cover"
          />
        </div>
      )}
    </div>
  );
}

// ── Main panel ──

type DramaPropertyPanelProps = {
  node: CanvasNodeData | null;
  onClose: () => void;
  onSendCommand?: (nodeId: string, command: string) => void;
  busy?: boolean;
};

export function DramaPropertyPanel({ node, onClose, onSendCommand, busy = false }: DramaPropertyPanelProps) {
  if (!node) return null;

  const isDramaNode =
    node.type === CanvasNodeType.Script ||
    node.type === CanvasNodeType.Shot ||
    node.type === CanvasNodeType.Character ||
    node.type === CanvasNodeType.Scene;

  if (!isDramaNode) return null;

  return (
    <div
      data-testid="drama-property-panel"
      data-drama-node-type={node.type}
      className="flex h-full w-[320px] shrink-0 flex-col border-l"
      style={{
        background: canvasTheme.canvas.background,
        borderColor: canvasTheme.node.stroke,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: canvasTheme.node.stroke }}
      >
        <span className="text-xs font-semibold" style={{ color: canvasTheme.node.text }}>
          属性
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 transition hover:bg-white/10"
          aria-label="关闭面板"
        >
          <X className="size-3.5" style={{ color: canvasTheme.node.faint }} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {node.type === CanvasNodeType.Script && <ScriptPanel node={node} />}
        {node.type === CanvasNodeType.Shot && <ShotPanel node={node} />}
        {node.type === CanvasNodeType.Character && <CharacterPanel node={node} />}
        {node.type === CanvasNodeType.Scene && <ScenePanel node={node} />}
      </div>

      {/* Chat input */}
      {onSendCommand && (
        <DramaNodeChat node={node} onSendCommand={onSendCommand} busy={busy} />
      )}
    </div>
  );
}
