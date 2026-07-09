import { assetUrl } from "@/lib/api-client";
import {
  CanvasNodeType,
  type CanvasConnection,
  type CanvasNodeData,
  type CanvasNodeMetadata,
} from "@/components/infinite-canvas/types";
import {
  getWorkflowTool,
  isWorkflowToolId,
  type WorkflowToolId,
} from "@/lib/workflow-tool-registry";

export function buildWorkflowNodeKey(sessionId: string, nodeId: string): string {
  return `${sessionId}:${nodeId}`;
}

/** 从上游节点解析可注入的媒体 URL */
export function resolveNodeOutputUrl(node: CanvasNodeData): string | null {
  const content = node.metadata?.content?.trim();
  if (content) return content;
  if (node.metadata?.keyframeOutputId) {
    return assetUrl(`/outputs/${node.metadata.keyframeOutputId}`);
  }
  return null;
}

function toolAcceptsImages(toolType: WorkflowToolId | undefined): boolean {
  if (!toolType) return false;
  return [
    "IMAGE_TO_IMAGE",
    "IMAGE_TO_VIDEO",
    "IMAGE_OUTPAINTING",
    "IMAGE_UPSCALE",
    "LIGHTING_MODIFICATION",
  ].includes(toolType);
}

function toolAcceptsVideos(toolType: WorkflowToolId | undefined): boolean {
  return toolType === "IMAGE_TO_VIDEO";
}

function toolAcceptsAudio(toolType: WorkflowToolId | undefined): boolean {
  return toolType === "AUDIO_GENERATION" || toolType === "MUSIC_GENERATION";
}

function collectUpstreamUrls(
  nodeId: string,
  nodes: CanvasNodeData[],
  edges: CanvasConnection[],
): { images: string[]; videos: string[]; audios: string[] } {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const images: string[] = [];
  const videos: string[] = [];
  const audios: string[] = [];

  for (const edge of edges) {
    if (edge.toNodeId !== nodeId) continue;
    const upstream = nodeById.get(edge.fromNodeId);
    if (!upstream) continue;
    const url = resolveNodeOutputUrl(upstream);
    if (!url) continue;
    if (upstream.type === CanvasNodeType.Video) {
      videos.push(url);
    } else if (upstream.type === CanvasNodeType.Audio) {
      audios.push(url);
    } else {
      images.push(url);
    }
  }

  return {
    images: [...new Set(images)],
    videos: [...new Set(videos)],
    audios: [...new Set(audios)],
  };
}

function patchConnectedMetadata(
  toolType: WorkflowToolId | undefined,
  upstream: { images: string[]; videos: string[]; audios: string[] },
): Partial<CanvasNodeMetadata> {
  const patch: Partial<CanvasNodeMetadata> = {};
  if (toolAcceptsImages(toolType) && upstream.images.length > 0) {
    patch.connectedImageUrls = upstream.images;
  }
  if (toolAcceptsVideos(toolType) && upstream.videos.length > 0) {
    patch.connectedVideoUrls = upstream.videos;
  }
  if (toolAcceptsAudio(toolType) && upstream.audios.length > 0) {
    patch.connectedAudioUrls = upstream.audios;
  }
  return patch;
}

/**
 * 根据连线为工作流工具节点注入 connected*Urls（对标 NeoWOW story-canvas）
 */
export function injectWorkflowConnectedUrls(
  nodes: CanvasNodeData[],
  edges: CanvasConnection[],
): CanvasNodeData[] {
  return nodes.map((node) => {
    const rawType = node.metadata?.workflowToolType;
    if (!rawType || !isWorkflowToolId(rawType)) return node;
    const tool = getWorkflowTool(rawType);
    if (!tool) return node;

    const upstream = collectUpstreamUrls(node.id, nodes, edges);
    const patch = patchConnectedMetadata(rawType, upstream);
    if (Object.keys(patch).length === 0) return node;

    return {
      ...node,
      metadata: {
        ...node.metadata,
        ...patch,
      },
    };
  });
}

export function buildWorkflowConnectionSyncOps(
  nodes: CanvasNodeData[],
  edges: CanvasConnection[],
): { nodeId: string; patch: Partial<CanvasNodeMetadata> }[] {
  const synced = injectWorkflowConnectedUrls(nodes, edges);
  const ops: { nodeId: string; patch: Partial<CanvasNodeMetadata> }[] = [];

  for (const next of synced) {
    const prev = nodes.find((n) => n.id === next.id);
    if (!prev?.metadata?.workflowToolType) continue;
    const prevMeta = prev.metadata ?? {};
    const nextMeta = next.metadata ?? {};
    const changed =
      JSON.stringify(prevMeta.connectedImageUrls ?? []) !==
        JSON.stringify(nextMeta.connectedImageUrls ?? []) ||
      JSON.stringify(prevMeta.connectedVideoUrls ?? []) !==
        JSON.stringify(nextMeta.connectedVideoUrls ?? []) ||
      JSON.stringify(prevMeta.connectedAudioUrls ?? []) !==
        JSON.stringify(nextMeta.connectedAudioUrls ?? []);
    if (changed) {
      ops.push({
        nodeId: next.id,
        patch: {
          connectedImageUrls: nextMeta.connectedImageUrls,
          connectedVideoUrls: nextMeta.connectedVideoUrls,
          connectedAudioUrls: nextMeta.connectedAudioUrls,
        },
      });
    }
  }

  return ops;
}
