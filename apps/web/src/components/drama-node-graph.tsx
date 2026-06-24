"use client";

import { useCallback, useEffect, useState } from "react";
import type { DramaProjectPayload, DramaRunGraph } from "@/lib/types";

const STATUS_STYLES: Record<
  DramaRunGraph["nodes"][number]["status"],
  string
> = {
  pending: "border-white/10 bg-black/20 text-zinc-500",
  running: "border-violet-500/50 bg-violet-500/15 text-violet-200",
  done: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  failed: "border-red-500/40 bg-red-500/10 text-red-300",
};

const STATUS_ICON: Record<DramaRunGraph["nodes"][number]["status"], string> = {
  pending: "○",
  running: "→",
  done: "✓",
  failed: "✗",
};

const EDITABLE_NODE_IDS = new Set(["keyframes", "shot_videos"]);

export type DramaNodeRerunPatch = {
  shots?: Array<{ id: string; motionPrompt?: string }>;
};

interface DramaNodeGraphProps {
  graph: DramaRunGraph;
  className?: string;
  shots?: DramaProjectPayload["shots"];
  interactive?: boolean;
  rerunBusy?: boolean;
  onRerunFromNode?: (
    nodeId: DramaRunGraph["nodes"][number]["id"],
    projectPatch: DramaNodeRerunPatch,
  ) => void;
}

/** 制作流水线 DAG；B-S3 支持节点参数编辑与局部重跑 */
export function DramaNodeGraph({
  graph,
  className,
  shots = [],
  interactive = false,
  rerunBusy = false,
  onRerunFromNode,
}: DramaNodeGraphProps) {
  const [selectedNodeId, setSelectedNodeId] =
    useState<DramaRunGraph["nodes"][number]["id"] | null>(null);
  const [motionDrafts, setMotionDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const shot of shots) {
      next[shot.id] = shot.motionPrompt ?? "";
    }
    setMotionDrafts(next);
  }, [shots]);

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge.target);
    outgoing.set(edge.source, list);
  }

  const ordered: typeof graph.nodes = [];
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    const node = nodeById.get(id);
    if (node) ordered.push(node);
    for (const next of outgoing.get(id) ?? []) visit(next);
  };
  for (const node of graph.nodes) visit(node.id);
  const displayNodes =
    ordered.length === graph.nodes.length ? ordered : graph.nodes;

  const handleRerun = useCallback(() => {
    if (!selectedNodeId || !onRerunFromNode) return;
    const patch: DramaNodeRerunPatch = {};
    if (EDITABLE_NODE_IDS.has(selectedNodeId) && shots.length > 0) {
      patch.shots = shots.map((shot) => ({
        id: shot.id,
        motionPrompt: motionDrafts[shot.id] ?? shot.motionPrompt,
      }));
    }
    onRerunFromNode(selectedNodeId, patch);
  }, [motionDrafts, onRerunFromNode, selectedNodeId, shots]);

  const showEditor =
    interactive &&
    selectedNodeId &&
    EDITABLE_NODE_IDS.has(selectedNodeId) &&
    shots.length > 0;

  return (
    <div className={className} data-testid="drama-node-graph">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-xs font-medium text-zinc-300">制作节点流</h4>
        <span className="text-[10px] text-zinc-500">{graph.skillId}</span>
      </div>
      <div
        className="flex flex-wrap items-stretch gap-1 overflow-x-auto pb-1"
        data-testid="drama-node-graph-track"
      >
        {displayNodes.map((node, i) => {
          const isSelected = selectedNodeId === node.id;
          const canSelect = interactive && Boolean(onRerunFromNode);
          return (
            <div key={node.id} className="flex items-center gap-1">
              <button
                type="button"
                disabled={!canSelect}
                onClick={() =>
                  canSelect
                    ? setSelectedNodeId((prev) =>
                        prev === node.id ? null : node.id,
                      )
                    : undefined
                }
                className={`min-w-[7.5rem] rounded-lg border px-2 py-1.5 text-left text-[10px] transition ${
                  STATUS_STYLES[node.status]
                } ${canSelect ? "cursor-pointer hover:brightness-110" : "cursor-default"} ${
                  isSelected ? "ring-1 ring-violet-400/60" : ""
                }`}
                data-testid={`drama-node-${node.id}`}
                data-status={node.status}
                aria-pressed={isSelected}
              >
                <div className="flex items-center gap-1">
                  <span aria-hidden>{STATUS_ICON[node.status]}</span>
                  <span className="font-medium leading-tight">{node.label}</span>
                </div>
              </button>
              {i < displayNodes.length - 1 ? (
                <span className="text-[10px] text-zinc-600" aria-hidden>
                  →
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {showEditor ? (
        <div
          className="mt-3 space-y-2 rounded-lg border border-white/10 bg-black/20 p-2"
          data-testid="drama-node-editor"
        >
          <p className="text-[10px] text-zinc-400">
            编辑镜头运动描述后，从「
            {nodeById.get(selectedNodeId!)?.label ?? selectedNodeId}」重跑后续步骤
          </p>
          <div className="max-h-40 space-y-2 overflow-y-auto">
            {shots.map((shot) => (
              <label
                key={shot.id}
                className="block text-[10px] text-zinc-500"
                data-testid={`drama-node-shot-motion-${shot.order + 1}`}
              >
                <span className="mb-0.5 block text-zinc-400">
                  镜 {shot.order + 1}
                </span>
                <textarea
                  className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-zinc-200"
                  rows={2}
                  value={motionDrafts[shot.id] ?? ""}
                  onChange={(e) =>
                    setMotionDrafts((prev) => ({
                      ...prev,
                      [shot.id]: e.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={rerunBusy}
            onClick={handleRerun}
            className="w-full rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            data-testid="drama-node-rerun-submit"
          >
            {rerunBusy ? "重跑中…" : "从此节点重跑"}
          </button>
        </div>
      ) : interactive && selectedNodeId && onRerunFromNode ? (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2">
          <button
            type="button"
            disabled={rerunBusy}
            onClick={handleRerun}
            className="w-full rounded-lg border border-violet-500/40 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-500/10 disabled:opacity-50"
            data-testid="drama-node-rerun-submit"
          >
            {rerunBusy ? "重跑中…" : `从「${nodeById.get(selectedNodeId)?.label ?? selectedNodeId}」重跑`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
