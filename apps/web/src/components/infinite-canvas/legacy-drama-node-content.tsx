"use client";

import type { CanvasNodeData } from "./types";
import { canvasTheme } from "./canvas-theme";

/** 已下线 Drama 节点类型的占位渲染（向后兼容读取旧 layout） */
function LegacyDramaNodeContent({ node }: { node: CanvasNodeData }) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center"
      style={{ color: canvasTheme.node.placeholder }}
    >
      <span className="text-xs text-zinc-500">短剧节点（已归档）</span>
      <span className="line-clamp-2 text-sm">{node.title}</span>
    </div>
  );
}

export function ScriptNodeContent(props: { node: CanvasNodeData }) {
  return <LegacyDramaNodeContent node={props.node} />;
}

export function ShotNodeContent(props: { node: CanvasNodeData }) {
  return <LegacyDramaNodeContent node={props.node} />;
}

export function CharacterNodeContent(props: { node: CanvasNodeData }) {
  return <LegacyDramaNodeContent node={props.node} />;
}

export function SceneNodeContent(props: { node: CanvasNodeData }) {
  return <LegacyDramaNodeContent node={props.node} />;
}
