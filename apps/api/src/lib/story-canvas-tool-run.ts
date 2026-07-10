import { z } from "zod";
import { createGenerationJob } from "./jobs.js";
import { AppError } from "./errors.js";
import { assertSessionWrite } from "./session-access.js";
import { getTool } from "./tools.js";
import { mergeExpandToolContext } from "./expand-run.js";
import { expandExtendSchema } from "./expand-extend.js";

/** workflowToolType → Studio toolType */
export const WORKFLOW_STUDIO_TOOL_MAP = {
  IMAGE_OUTPAINTING: { toolId: "expand", requiresSource: true },
  IMAGE_UPSCALE: { toolId: "upscale", requiresSource: true },
  LIGHTING_MODIFICATION: { toolId: "lighting-control", requiresSource: true },
  MUSIC_GENERATION: { toolId: "music-gen", requiresSource: false },
  AUDIO_GENERATION: { toolId: "tts", requiresSource: false },
} as const;

export type WorkflowStudioToolKey = keyof typeof WORKFLOW_STUDIO_TOOL_MAP;

export function isWorkflowStudioToolType(
  value: string | undefined,
): value is WorkflowStudioToolKey {
  return Boolean(value && value in WORKFLOW_STUDIO_TOOL_MAP);
}

export const workflowRunBaseBody = z.object({
  sessionId: z.string().uuid(),
  nodeKey: z.string().min(1).max(200),
  prompt: z.string().max(4000).optional(),
  workflowToolType: z.string().optional(),
  referenceUrls: z.array(z.string()).max(12).optional(),
});

export const workflowOutpaintingBody = workflowRunBaseBody.extend({
  extend: expandExtendSchema.optional(),
});

export const workflowUpscaleBody = workflowRunBaseBody.extend({
  scale: z.enum(["2x", "4x"]).optional(),
});

export const workflowLightingBody = workflowRunBaseBody.extend({
  lights: z
    .array(
      z.object({
        id: z.string().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        colorTemp: z.enum(["warm", "neutral", "cool"]).optional(),
        intensity: z.number().optional(),
        type: z.enum(["point", "area", "spotlight"]).optional(),
      }),
    )
    .max(12)
    .optional(),
});

export const workflowMusicBody = workflowRunBaseBody.extend({
  style: z.string().max(500).optional(),
  bpm: z.number().int().min(60).max(200).optional(),
  durationSec: z.number().int().min(10).max(120).optional(),
});

export const workflowAudioBody = workflowRunBaseBody.extend({
  voiceStyle: z.string().max(200).optional(),
  voiceId: z.string().max(100).optional(),
});

function assertReferenceUrls(
  workflowToolType: WorkflowStudioToolKey,
  referenceUrls: string[] | undefined,
) {
  const meta = WORKFLOW_STUDIO_TOOL_MAP[workflowToolType];
  if (meta.requiresSource && !(referenceUrls?.length ?? 0)) {
    throw new AppError(
      400,
      "SOURCE_REQUIRED",
      "请连接上游图片节点或提供参考图",
    );
  }
}

function workflowJobResult(nodeKey: string, jobId: string, pointsCost: number) {
  return { nodeKey, jobId, status: "pending" as const, pointsCost };
}

function runWorkflowStudioImageTool(
  userId: string,
  body: z.infer<typeof workflowRunBaseBody>,
  workflowToolType: WorkflowStudioToolKey,
  extra?: {
    scale?: "2x" | "4x";
    extend?: z.infer<typeof expandExtendSchema>;
    lights?: z.infer<typeof workflowLightingBody>["lights"];
  },
) {
  assertSessionWrite(userId, body.sessionId);
  assertReferenceUrls(workflowToolType, body.referenceUrls);

  const mapping = WORKFLOW_STUDIO_TOOL_MAP[workflowToolType];
  const tool = getTool(mapping.toolId);
  if (!tool) {
    throw new AppError(404, "NOT_FOUND", "工作流工具不可用");
  }

  let prompt = body.prompt?.trim() || tool.defaultPrompt;
  if (mapping.toolId === "upscale" && extra?.scale) {
    prompt = `${prompt}（${extra.scale} 放大）`;
  }

  const toolContext = mergeExpandToolContext(mapping.toolId, {
    extend: extra?.extend,
    toolContext:
      extra?.lights ?
        {
          toolId: mapping.toolId,
          masks: [],
          lights: extra.lights,
        }
      : undefined,
  });

  const { jobId, pointsCost } = createGenerationJob({
    sessionId: body.sessionId,
    userId,
    prompt: `【${tool.name}】${prompt}`,
    modelId: "omni-v2",
    mode: "chat",
    count: 1,
    resolution: "1k",
    toolType: mapping.toolId,
    referenceUrls: body.referenceUrls,
    sourceLane: "image",
    toolContext: {
      ...toolContext,
      workflowNodeKey: body.nodeKey,
      workflowToolType: body.workflowToolType ?? workflowToolType,
    },
  });

  return workflowJobResult(body.nodeKey, jobId, pointsCost);
}

export function runWorkflowOutpainting(
  userId: string,
  body: z.infer<typeof workflowOutpaintingBody>,
) {
  return runWorkflowStudioImageTool(userId, body, "IMAGE_OUTPAINTING", {
    extend: body.extend,
  });
}

export function runWorkflowUpscale(
  userId: string,
  body: z.infer<typeof workflowUpscaleBody>,
) {
  return runWorkflowStudioImageTool(userId, body, "IMAGE_UPSCALE", {
    scale: body.scale,
  });
}

export function runWorkflowLighting(
  userId: string,
  body: z.infer<typeof workflowLightingBody>,
) {
  return runWorkflowStudioImageTool(userId, body, "LIGHTING_MODIFICATION", {
    lights: body.lights,
  });
}

export function runWorkflowMusic(
  userId: string,
  body: z.infer<typeof workflowMusicBody>,
) {
  assertSessionWrite(userId, body.sessionId);
  const style =
    body.style?.trim() ||
    body.prompt?.trim() ||
    "轻快电子乐";
  const bpm = body.bpm ?? 120;
  const durationSec = body.durationSec ?? 30;

  const { jobId, pointsCost } = createGenerationJob({
    sessionId: body.sessionId,
    userId,
    prompt: `【AI 音乐生成】风格: ${style}, BPM: ${bpm}, 时长: ${durationSec}s`,
    modelId: "omni-v2",
    mode: "chat",
    count: 1,
    resolution: "1k",
    toolType: "music-gen",
    sourceLane: "image",
    toolContext: {
      toolId: "music-gen",
      masks: [],
      style,
      bpm,
      durationSec,
      workflowNodeKey: body.nodeKey,
      workflowToolType: body.workflowToolType ?? "MUSIC_GENERATION",
    },
  });

  return workflowJobResult(body.nodeKey, jobId, pointsCost);
}

export function runWorkflowAudio(
  userId: string,
  body: z.infer<typeof workflowAudioBody>,
) {
  assertSessionWrite(userId, body.sessionId);
  const text = body.prompt?.trim() || "自然中文对白配音";

  const { jobId, pointsCost } = createGenerationJob({
    sessionId: body.sessionId,
    userId,
    prompt: text,
    modelId: "omni-v2",
    mode: "chat",
    count: 1,
    resolution: "1k",
    toolType: "tts",
    sourceLane: "image",
    toolContext: {
      workflowNodeKey: body.nodeKey,
      workflowToolType: body.workflowToolType ?? "AUDIO_GENERATION",
      voiceStyle: body.voiceStyle,
      voiceId: body.voiceId,
    },
  });

  return workflowJobResult(body.nodeKey, jobId, pointsCost);
}
