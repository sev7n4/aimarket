"use client";

import type { DramaRunGraph } from "@/lib/types";

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

interface DramaNodeGraphProps {
  graph: DramaRunGraph;
  className?: string;
}

/** 制作流水线只读 DAG（PROD-B01） */
export function DramaNodeGraph({ graph, className }: DramaNodeGraphProps) {
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

  return (
    <div
      className={className}
      data-testid="drama-node-graph"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-xs font-medium text-zinc-300">制作节点流</h4>
        <span className="text-[10px] text-zinc-500">{graph.skillId}</span>
      </div>
      <div
        className="flex flex-wrap items-stretch gap-1 overflow-x-auto pb-1"
        data-testid="drama-node-graph-track"
      >
        {displayNodes.map((node, i) => (
          <div key={node.id} className="flex items-center gap-1">
            <div
              className={`min-w-[7.5rem] rounded-lg border px-2 py-1.5 text-[10px] ${STATUS_STYLES[node.status]}`}
              data-testid={`drama-node-${node.id}`}
              data-status={node.status}
            >
              <div className="flex items-center gap-1">
                <span aria-hidden>{STATUS_ICON[node.status]}</span>
                <span className="font-medium leading-tight">{node.label}</span>
              </div>
            </div>
            {i < displayNodes.length - 1 ? (
              <span className="text-[10px] text-zinc-600" aria-hidden>
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
