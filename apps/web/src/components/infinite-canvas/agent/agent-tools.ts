/**
 * Canvas Agent 工具定义
 * 包含 22 个基础画布工具 + 9 个 Drama 专用工具的 JSON Schema
 */

import type { CanvasAgentOp, CanvasAgentSnapshot } from "../utils";
import { CanvasNodeType } from "../types";
import type { OrchestratorToolDefinition } from "./types";

// ── Schema builders ──

const POSITION_SCHEMA = {
  type: "object" as const,
  properties: { x: { type: "number" }, y: { type: "number" } },
  required: ["x", "y"],
  additionalProperties: false,
};

const VIEWPORT_SCHEMA = {
  type: "object" as const,
  properties: { x: { type: "number" }, y: { type: "number" }, k: { type: "number" } },
  required: ["x", "y", "k"],
  additionalProperties: false,
};

const NODE_TYPE_SCHEMA = {
  type: "string" as const,
  enum: ["image", "text", "config", "video", "audio", "script", "shot", "character", "scene"],
};

const GENERATION_MODE_SCHEMA = {
  type: "string" as const,
  enum: ["text", "image", "video", "audio"],
};

const CANVAS_OP_SCHEMA = {
  type: "object" as const,
  properties: {
    type: {
      type: "string" as const,
      enum: [
        "add_node", "update_node", "delete_node", "delete_connections",
        "connect_nodes", "set_viewport", "select_nodes", "group_nodes", "run_generation",
        // Drama ops
        "update_shot_status", "update_character_ref", "update_scene_ref", "focus_drama_node",
      ],
    },
    id: { type: "string" },
    ids: { type: "array", items: { type: "string" } },
    nodeType: NODE_TYPE_SCHEMA,
    title: { type: "string" },
    x: { type: "number" },
    y: { type: "number" },
    width: { type: "number" },
    height: { type: "number" },
    position: POSITION_SCHEMA,
    metadata: { type: "object", additionalProperties: true },
    patch: { type: "object", additionalProperties: true },
    all: { type: "boolean" },
    fromNodeId: { type: "string" },
    toNodeId: { type: "string" },
    viewport: VIEWPORT_SCHEMA,
    nodeId: { type: "string" },
    mode: GENERATION_MODE_SCHEMA,
    prompt: { type: "string" },
    // Drama op fields
    status: { type: "string" },
    keyframeOutputId: { type: "string" },
    videoOutputId: { type: "string" },
    refUrl: { type: "string" },
    turnaroundStatus: { type: "string", enum: ["draft", "locked"] },
    sceneRefUrl: { type: "string" },
    // connect_nodes
    connections: {
      type: "array",
      items: {
        type: "object",
        properties: { fromNodeId: { type: "string" }, toNodeId: { type: "string" } },
        required: ["fromNodeId", "toNodeId"],
        additionalProperties: false,
      },
    },
    // move_nodes
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          dx: { type: "number" },
          dy: { type: "number" },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  required: ["type"],
  additionalProperties: false,
};

function tool(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
): OrchestratorToolDefinition {
  return {
    name,
    description,
    parameters: {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    },
  };
}

// ── Read-only tools (no user confirmation needed) ──

const READ_TOOL_NAMES = new Set([
  "canvas_get_state",
  "canvas_get_selection",
  "canvas_export_snapshot",
]);

export function isReadOnlyTool(name: string): boolean {
  return READ_TOOL_NAMES.has(name);
}

// ── Canvas Agent tools ──

export const CANVAS_AGENT_TOOLS: OrchestratorToolDefinition[] = [
  // Read tools
  tool("canvas_get_state", "读取当前网页画布的节点、连线、选区和视口。", {}),
  tool("canvas_get_selection", "读取当前网页画布选中的节点。", {}),
  tool("canvas_export_snapshot", "导出当前画布快照，用于理解布局。", {}),

  // Batch operations
  tool(
    "canvas_apply_ops",
    "批量操作当前网页画布。支持所有 CanvasAgentOp 类型。",
    { ops: { type: "array", items: CANVAS_OP_SCHEMA } },
    ["ops"],
  ),

  // Node creation
  tool(
    "canvas_create_node",
    "创建任意类型节点。",
    {
      nodeType: NODE_TYPE_SCHEMA,
      title: { type: "string" },
      x: { type: "number" },
      y: { type: "number" },
      width: { type: "number" },
      height: { type: "number" },
      metadata: { type: "object", additionalProperties: true },
    },
    ["nodeType"],
  ),
  tool(
    "canvas_create_text_node",
    "在当前画布创建单个文本节点。",
    {
      text: { type: "string" },
      x: { type: "number" },
      y: { type: "number" },
      title: { type: "string" },
      width: { type: "number" },
      height: { type: "number" },
    },
  ),
  tool(
    "canvas_create_config_node",
    "创建生成配置节点。",
    {
      prompt: { type: "string" },
      mode: GENERATION_MODE_SCHEMA,
      title: { type: "string" },
      x: { type: "number" },
      y: { type: "number" },
      autoRun: { type: "boolean" },
    },
    ["prompt"],
  ),

  // Generation
  tool(
    "canvas_generate_image",
    "在画布上创建图片生成流程并立即触发生成。",
    {
      prompt: { type: "string" },
      x: { type: "number" },
      y: { type: "number" },
      model: { type: "string" },
      size: { type: "string" },
    },
    ["prompt"],
  ),
  tool(
    "canvas_generate_video",
    "在画布上创建视频生成流程并立即触发生成。",
    {
      prompt: { type: "string" },
      x: { type: "number" },
      y: { type: "number" },
      seconds: { type: "number" },
    },
    ["prompt"],
  ),

  // Node update
  tool(
    "canvas_update_node",
    "更新节点基础字段或 metadata。",
    {
      id: { type: "string" },
      patch: { type: "object", additionalProperties: true },
      metadata: { type: "object", additionalProperties: true },
    },
    ["id"],
  ),
  tool(
    "canvas_update_node_text",
    "更新文本节点内容和标题。",
    {
      id: { type: "string" },
      text: { type: "string" },
      title: { type: "string" },
    },
    ["id", "text"],
  ),

  // Node movement
  tool(
    "canvas_move_nodes",
    "移动一个或多个节点。",
    { items: { type: "array", items: CANVAS_OP_SCHEMA.properties.items.items } },
    ["items"],
  ),

  // Node deletion
  tool(
    "canvas_delete_nodes",
    "删除指定节点及相关连线。",
    { ids: { type: "array", items: { type: "string" } } },
    ["ids"],
  ),

  // Connections
  tool(
    "canvas_connect_nodes",
    "批量连接节点。",
    { connections: CANVAS_OP_SCHEMA.properties.connections },
    ["connections"],
  ),

  // Selection & viewport
  tool(
    "canvas_select_nodes",
    "设置当前选中节点。",
    { ids: { type: "array", items: { type: "string" } } },
    ["ids"],
  ),
  tool("canvas_set_viewport", "调整画布视口。", { viewport: VIEWPORT_SCHEMA }, ["viewport"]),
  tool(
    "canvas_run_generation",
    "触发指定节点生成。",
    {
      nodeId: { type: "string" },
      mode: GENERATION_MODE_SCHEMA,
      prompt: { type: "string" },
    },
    ["nodeId"],
  ),
  tool(
    "canvas_group_nodes",
    "将多个节点整理为网格布局并设置分组标识；可选创建分组标题文本节点。",
    {
      ids: { type: "array", items: { type: "string" } },
      title: { type: "string" },
      gap: { type: "number" },
      columns: { type: "number" },
      createLabel: { type: "boolean" },
    },
    ["ids"],
  ),
];

// ── Drama tools ──

export const DRAMA_TOOLS: OrchestratorToolDefinition[] = [
  tool(
    "drama_plan",
    "根据用户想法一键生成完整剧本规划（剧本、角色、场景、分镜）。",
    { idea: { type: "string" }, aspectRatio: { type: "string", enum: ["9:16", "16:9"] }, targetDurationSec: { type: "number" } },
    ["idea"],
  ),
  tool("drama_create_script", "创建剧本节点。", { title: { type: "string" }, x: { type: "number" }, y: { type: "number" } }, ["title"]),
  tool("drama_create_character", "创建角色节点。", { name: { type: "string" }, x: { type: "number" }, y: { type: "number" } }, ["name"]),
  tool("drama_create_shot", "创建分镜节点。", { x: { type: "number" }, y: { type: "number" }, sceneId: { type: "string" } }, []),
  tool("drama_create_scene", "创建场景节点。", { name: { type: "string" }, location: { type: "string" }, x: { type: "number" }, y: { type: "number" } }, ["name"]),

  // Generation
  tool(
    "drama_generate_character_sheet",
    "为角色节点生成三视图参考图。",
    { characterNodeId: { type: "string" } },
    ["characterNodeId"],
  ),
  tool(
    "drama_generate_shot_image",
    "为分镜节点生成关键帧图片。",
    { shotNodeId: { type: "string" } },
    ["shotNodeId"],
  ),
  tool(
    "drama_generate_shot_video",
    "为分镜节点生成视频。",
    { shotNodeId: { type: "string" } },
    ["shotNodeId"],
  ),

  // Production
  tool("drama_run_production", "触发 Drama 制作流水线。", { projectPatch: { type: "object", additionalProperties: true } }, []),
];

export const ALL_AGENT_TOOLS: OrchestratorToolDefinition[] = [
  ...CANVAS_AGENT_TOOLS,
  ...DRAMA_TOOLS,
];

// ── Tool → CanvasAgentOp converter ──

type ToolArgs = Record<string, unknown>;

function ensureNodeExists(snapshot: CanvasAgentSnapshot, nodeId: string): boolean {
  return snapshot.nodes.some((n) => n.id === nodeId);
}

function newCanvasNodeId(nodeType: CanvasNodeType, index = 0): string {
  return `${nodeType}-${Date.now()}-${index}`;
}

export function onlineToolToOps(
  toolName: string,
  args: ToolArgs,
  snapshot: CanvasAgentSnapshot,
): CanvasAgentOp[] {
  switch (toolName) {
    case "canvas_get_state":
    case "canvas_get_selection":
    case "canvas_export_snapshot":
      return []; // Read-only, no op needed

    case "canvas_apply_ops": {
      const ops = args.ops as ToolArgs[];
      if (!Array.isArray(ops)) return [];
      return ops
        .map((op) => {
          if (typeof op !== "object" || op === null) return null;
          const t = op.type as string;
          if (!t) return null;
          return {
            type: t,
            ...(op.id != null ? { id: op.id } : {}),
            ...(op.ids != null ? { ids: op.ids as string[] } : {}),
            ...(op.nodeType != null ? { nodeType: op.nodeType } : {}),
            ...(op.title != null ? { title: op.title as string } : {}),
            ...(op.x != null ? { x: op.x as number } : {}),
            ...(op.y != null ? { y: op.y as number } : {}),
            ...(op.width != null ? { width: op.width as number } : {}),
            ...(op.height != null ? { height: op.height as number } : {}),
            ...(op.position != null ? { position: op.position as { x: number; y: number } } : {}),
            ...(op.metadata != null ? { metadata: op.metadata as Record<string, unknown> } : {}),
            ...(op.patch != null ? { patch: op.patch as Record<string, unknown> } : {}),
            ...(op.all != null ? { all: op.all as boolean } : {}),
            ...(op.fromNodeId != null ? { fromNodeId: op.fromNodeId as string } : {}),
            ...(op.toNodeId != null ? { toNodeId: op.toNodeId as string } : {}),
            ...(op.viewport != null ? { viewport: op.viewport as { x: number; y: number; k: number } } : {}),
            ...(op.nodeId != null ? { nodeId: op.nodeId as string } : {}),
            ...(op.mode != null ? { mode: op.mode as "text" | "image" | "video" | "audio" } : {}),
            ...(op.prompt != null ? { prompt: op.prompt as string } : {}),
            ...(op.gap != null ? { gap: op.gap as number } : {}),
            ...(op.columns != null ? { columns: op.columns as number } : {}),
            ...(op.createLabel != null ? { createLabel: op.createLabel as boolean } : {}),
          } as CanvasAgentOp;
        })
        .filter((op): op is CanvasAgentOp => op !== null);
    }

    case "canvas_create_node":
      return [
        {
          type: "add_node",
          nodeType: args.nodeType as CanvasNodeType,
          title: (args.title as string) || "新节点",
          x: args.x as number,
          y: args.y as number,
          width: args.width as number | undefined,
          height: args.height as number | undefined,
          metadata: args.metadata as Record<string, unknown> | undefined,
        },
      ];

    case "canvas_create_text_node":
      return [
        {
          type: "add_node",
          nodeType: CanvasNodeType.Text,
          title: (args.title as string) || "",
          x: args.x as number,
          y: args.y as number,
          width: args.width as number | undefined,
          height: args.height as number | undefined,
          metadata: { content: args.text as string },
        },
      ];

    case "canvas_create_config_node": {
      const nodeId = newCanvasNodeId(CanvasNodeType.Config);
      const mode = args.mode as "text" | "image" | "video" | "audio";
      return [
        {
          type: "add_node",
          id: nodeId,
          nodeType: CanvasNodeType.Config,
          title: (args.title as string) || "配置",
          x: args.x as number,
          y: args.y as number,
          metadata: {
            generationMode: mode,
            prompt: args.prompt as string,
          },
        },
        ...(args.autoRun
          ? [
              {
                type: "run_generation" as const,
                nodeId,
                mode,
                prompt: args.prompt as string,
              },
            ]
          : []),
      ];
    }

    case "canvas_generate_image": {
      const x = (args.x as number) ?? snapshot.nodes.length * 400;
      const y = (args.y as number) ?? 200;
      const nodeId = newCanvasNodeId(CanvasNodeType.Image);
      return [
        {
          type: "add_node",
          id: nodeId,
          nodeType: CanvasNodeType.Image,
          title: "图片",
          x,
          y,
          metadata: { prompt: args.prompt as string | undefined, status: "loading" },
        },
        {
          type: "run_generation",
          nodeId,
          mode: "image",
          prompt: args.prompt as string,
        },
      ];
    }

    case "canvas_generate_video": {
      const x = (args.x as number) ?? snapshot.nodes.length * 400;
      const y = (args.y as number) ?? 200;
      const nodeId = newCanvasNodeId(CanvasNodeType.Video);
      return [
        {
          type: "add_node",
          id: nodeId,
          nodeType: CanvasNodeType.Video,
          title: "视频",
          x,
          y,
          metadata: { prompt: args.prompt as string | undefined, status: "loading" },
        },
        {
          type: "run_generation",
          nodeId,
          mode: "video",
          prompt: args.prompt as string,
        },
      ];
    }

    case "canvas_update_node": {
      const id = args.id as string;
      if (!id || !ensureNodeExists(snapshot, id)) return [];
      return [
        {
          type: "update_node",
          id,
          patch: args.patch as Record<string, unknown>,
          metadata: args.metadata as Record<string, unknown>,
        },
      ];
    }

    case "canvas_update_node_text": {
      const id = args.id as string;
      if (!id || !ensureNodeExists(snapshot, id)) return [];
      return [
        {
          type: "update_node",
          id,
          metadata: { content: args.text as string, ...(args.title ? { title: args.title } : {}) },
        },
      ];
    }

    case "canvas_move_nodes": {
      const items = args.items as Array<{ id: string; x?: number; y?: number; dx?: number; dy?: number }>;
      if (!Array.isArray(items)) return [];
      return items.flatMap((item) => {
        if (!item.id || !ensureNodeExists(snapshot, item.id)) return [];
        const existing = snapshot.nodes.find((n) => n.id === item.id);
        if (!existing) return [];
        const x = item.x ?? (item.dx ? existing.position.x + item.dx : existing.position.x);
        const y = item.y ?? (item.dy ? existing.position.y + item.dy : existing.position.y);
        return [{ type: "update_node" as const, id: item.id, patch: { position: { x, y } } }];
      });
    }

    case "canvas_delete_nodes": {
      const ids = args.ids as string[];
      if (!Array.isArray(ids) || !ids.length) return [];
      return [{ type: "delete_node", ids }];
    }

    case "canvas_connect_nodes": {
      const connections = args.connections as Array<{ fromNodeId: string; toNodeId: string }>;
      if (!Array.isArray(connections)) return [];
      return connections
        .filter((c) => c.fromNodeId && c.toNodeId)
        .map((c) => ({
          type: "connect_nodes" as const,
          fromNodeId: c.fromNodeId,
          toNodeId: c.toNodeId,
        }));
    }

    case "canvas_select_nodes": {
      const ids = args.ids as string[];
      if (!Array.isArray(ids)) return [];
      return [{ type: "select_nodes", ids }];
    }

    case "canvas_set_viewport": {
      const viewport = args.viewport as { x: number; y: number; k: number };
      if (!viewport) return [];
      return [{ type: "set_viewport", viewport }];
    }

    case "canvas_run_generation": {
      const nodeId = args.nodeId as string;
      if (!nodeId || !ensureNodeExists(snapshot, nodeId)) return [];
      return [
        {
          type: "run_generation",
          nodeId,
          mode: args.mode as "text" | "image" | "video" | "audio" | undefined,
          prompt: args.prompt as string | undefined,
        },
      ];
    }

    case "canvas_group_nodes": {
      const ids = args.ids as string[];
      if (!Array.isArray(ids) || !ids.length) return [];
      const existingIds = ids.filter((id) => ensureNodeExists(snapshot, id));
      if (!existingIds.length) return [];
      return [
        {
          type: "group_nodes",
          ids: existingIds,
          title: args.title as string | undefined,
          gap: args.gap as number | undefined,
          columns: args.columns as number | undefined,
          createLabel: args.createLabel as boolean | undefined,
        },
      ];
    }

    // Drama tools
    case "drama_create_script":
      return [
        {
          type: "add_node",
          nodeType: CanvasNodeType.Script,
          title: (args.title as string) || "剧本",
          x: (args.x as number) ?? 0,
          y: (args.y as number) ?? 200,
        },
      ];

    case "drama_create_character":
      return [
        {
          type: "add_node",
          nodeType: CanvasNodeType.Character,
          title: (args.name as string) || "角色",
          x: (args.x as number) ?? 500,
          y: (args.y as number) ?? 200,
          metadata: { characterName: args.name as string },
        },
      ];

    case "drama_create_shot":
      return [
        {
          type: "add_node",
          nodeType: CanvasNodeType.Shot,
          title: "分镜",
          x: (args.x as number) ?? 1000,
          y: (args.y as number) ?? 200,
          metadata: { sceneId: args.sceneId as string },
        },
      ];

    case "drama_create_scene":
      return [
        {
          type: "add_node",
          nodeType: CanvasNodeType.Scene,
          title: (args.name as string) || "场景",
          x: (args.x as number) ?? 500,
          y: (args.y as number) ?? 400,
          metadata: { sceneName: args.name as string, location: args.location as string },
        },
      ];

    case "drama_update_shot_status": {
      const shotNodeId = args.shotNodeId as string;
      if (!shotNodeId || !ensureNodeExists(snapshot, shotNodeId)) return [];
      return [
        {
          type: "update_shot_status",
          shotNodeId,
          status: args.status as "pending" | "keyframe" | "video" | "audio" | "done" | "failed",
          keyframeOutputId: args.keyframeOutputId as string | undefined,
          videoOutputId: args.videoOutputId as string | undefined,
        },
      ];
    }

    case "drama_update_character_ref": {
      const characterNodeId = args.characterNodeId as string;
      if (!characterNodeId || !ensureNodeExists(snapshot, characterNodeId)) return [];
      return [
        {
          type: "update_character_ref",
          characterNodeId,
          refUrl: args.refUrl as string | undefined,
          turnaroundStatus: args.turnaroundStatus as "draft" | "locked" | undefined,
        },
      ];
    }

    case "drama_update_scene_ref": {
      const sceneNodeId = args.sceneNodeId as string;
      if (!sceneNodeId || !ensureNodeExists(snapshot, sceneNodeId)) return [];
      return [
        {
          type: "update_scene_ref",
          sceneNodeId,
          sceneRefUrl: args.sceneRefUrl as string | undefined,
        },
      ];
    }

    case "drama_focus_node": {
      const nodeId = args.nodeId as string;
      if (!nodeId || !ensureNodeExists(snapshot, nodeId)) return [];
      return [{ type: "focus_drama_node", nodeId }];
    }

    case "drama_plan":
      return [
        {
          type: "plan_drama",
          idea: (args.idea as string) || "",
          aspectRatio: args.aspectRatio as string | undefined,
          targetDurationSec: args.targetDurationSec as number | undefined,
        },
      ];

    case "drama_generate_character_sheet": {
      const characterNodeId = args.characterNodeId as string;
      if (!characterNodeId || !ensureNodeExists(snapshot, characterNodeId)) return [];
      return [
        { type: "generate_character_sheet", characterNodeId },
        {
          type: "update_node",
          id: characterNodeId,
          metadata: { status: "loading", turnaroundStatus: "draft" },
        },
        { type: "focus_drama_node", nodeId: characterNodeId },
      ];
    }

    case "drama_generate_shot_image": {
      const shotNodeId = args.shotNodeId as string;
      if (!shotNodeId || !ensureNodeExists(snapshot, shotNodeId)) return [];
      return [
        { type: "generate_shot_image", shotNodeId },
        { type: "update_shot_status", shotNodeId, status: "keyframe" },
        { type: "focus_drama_node", nodeId: shotNodeId },
      ];
    }

    case "drama_generate_shot_video": {
      const shotNodeId = args.shotNodeId as string;
      if (!shotNodeId || !ensureNodeExists(snapshot, shotNodeId)) return [];
      return [
        { type: "generate_shot_video", shotNodeId },
        { type: "update_shot_status", shotNodeId, status: "video" },
        { type: "focus_drama_node", nodeId: shotNodeId },
      ];
    }

    case "drama_run_production":
      return [
        {
          type: "run_drama_production",
          projectPatch: args.projectPatch as Record<string, unknown> | undefined,
        },
      ];

    default:
      // Unknown tool — skip silently
      return [];
  }
}

// ── Describe snapshot for tool results ──

export function describeSnapshotForAgent(snapshot: CanvasAgentSnapshot): string {
  const nodes = snapshot.nodes;
  const connections = snapshot.connections;
  const lines: string[] = [];

  lines.push(`画布上有 ${nodes.length} 个节点，${connections.length} 条连线：`);
  lines.push("");

  for (const node of nodes) {
    const meta = node.metadata;
    let desc = `[${node.type}] "${node.title}" (id: ${node.id})`;
    if (node.type === "image" && meta?.content) desc += ` - 图片内容`;
    if (node.type === "text" && meta?.content) desc += ` - "${String(meta.content).slice(0, 50)}"`;
    if (node.type === "script") desc += ` - 剧本`;
    if (node.type === "shot") desc += ` - 分镜 #${meta?.shotOrder ?? "?"}`;
    if (node.type === "character") desc += ` - 角色: ${meta?.characterName ?? node.title}`;
    if (node.type === "scene") desc += ` - 场景: ${meta?.sceneName ?? node.title}`;
    if (meta?.status === "loading") desc += ` [生成中]`;
    if (meta?.status === "error") desc += ` [错误]`;
    lines.push(desc);
  }

  return lines.join("\n");
}
