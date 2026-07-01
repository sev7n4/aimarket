/**
 * 灯光控制 / 摄像机控制 Tool Provider
 *
 * - lighting-control: 接收一组光源配置（位置/色温/强度/类型），
 *   编码为中文 prompt 片段并重新生成图像
 * - camera-control: 接收景别 / 俯仰 / 水平参数，编码为 prompt 后缀
 *
 * 二者均复用 generateImages 跑单张图。
 */
import { generateImages } from "../registry.js";
import { resolveImageDimensions } from "../../lib/image-size.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

/* ========== 类型定义 ========== */

export type LightSource = {
  id?: string;
  x?: number; // 0-100 百分比
  y?: number;
  colorTemp?: "warm" | "neutral" | "cool";
  intensity?: number; // 0-100
  type?: "point" | "area" | "spotlight";
};

export type CameraParams = {
  shotSize?: string;
  movement?: string;
  pitch?: number; // -45 to 45
  yaw?: number; // -180 to 180
};

type LightingConfig = {
  sources?: LightSource[];
};

type CameraConfig = {
  camera?: CameraParams;
};

/* ========== 灯光编码 ========== */

const TEMP_LABELS: Record<NonNullable<LightSource["colorTemp"]>, string> = {
  warm: "暖光",
  neutral: "自然光",
  cool: "冷光",
};

const TYPE_LABELS: Record<NonNullable<LightSource["type"]>, string> = {
  point: "点光",
  area: "面光",
  spotlight: "聚光",
};

function describePosition(x: number | undefined, y: number | undefined): string {
  if (x == null || y == null) return "中央";
  const horiz =
    x < 33 ? "左侧" : x > 66 ? "右侧" : "中央";
  const vert =
    y < 33 ? "上方" : y > 66 ? "下方" : "中部";
  return `${vert}${horiz}`;
}

function describeIntensity(intensity: number | undefined): string {
  if (intensity == null) return "中等";
  if (intensity < 33) return "微弱";
  if (intensity < 67) return "中等";
  return "强烈";
}

export function encodeLightingPrompt(cfg: LightingConfig | undefined): string {
  const sources = cfg?.sources ?? [];
  if (sources.length === 0) return "";
  const parts = sources.map((s) => {
    const temp = TEMP_LABELS[s.colorTemp ?? "neutral"] ?? "自然光";
    const type = TYPE_LABELS[s.type ?? "point"] ?? "点光";
    const pos = describePosition(s.x, s.y);
    const intensity = describeIntensity(s.intensity);
    return `${pos}${intensity}${temp}（${type}）`;
  });
  return `灯光：${parts.join("，")}`;
}

/* ========== 摄像机编码 ========== */

const SHOT_SIZE_LABELS: Record<string, string> = {
  超远景: "extreme long shot",
  远景: "long shot",
  全景: "wide shot",
  中景: "medium shot",
  近景: "close-up shot",
  特写: "extreme close-up",
};

const MOVEMENT_LABELS: Record<string, string> = {
  固定: "static camera",
  推进: "slow push-in",
  拉远: "slow pull-out",
  摇镜: "camera pan",
  横移: "lateral tracking",
  跟拍: "follow shot",
};

export function encodeCameraPromptFromConfig(
  cfg: CameraConfig | undefined,
): string {
  const cam = cfg?.camera;
  if (!cam) return "";
  const parts: string[] = [];
  if (cam.shotSize) {
    parts.push(`景别：${cam.shotSize}`);
  }
  if (cam.movement && cam.movement !== "固定") {
    parts.push(`运镜：${cam.movement}`);
  }
  if (cam.pitch != null && cam.pitch !== 0) {
    parts.push(`俯仰：${cam.pitch > 0 ? "上" : "下"} ${Math.abs(cam.pitch)}°`);
  }
  if (cam.yaw != null && cam.yaw !== 0) {
    parts.push(`水平：${cam.yaw > 0 ? "右" : "左"} ${Math.abs(cam.yaw)}°`);
  }
  if (parts.length === 0) return "";
  return parts.join("，");
}

/* ========== Providers ========== */

const TOOL_IDS = new Set(["lighting-control", "camera-control"]);

function readContext(params: ToolRunParams): Record<string, unknown> {
  return (params.toolContext as Record<string, unknown>) ?? {};
}

function buildSuffix(toolId: string, params: ToolRunParams): string {
  const ctx = readContext(params);
  if (toolId === "lighting-control") {
    return encodeLightingPrompt({ sources: ctx.sources as LightSource[] | undefined });
  }
  return encodeCameraPromptFromConfig({
    camera: ctx.camera as CameraParams | undefined,
  });
}

export const lightingControlProvider: ImageToolProvider = {
  name: "tool-lighting-control",
  supports(toolId: string) {
    return toolId === "lighting-control";
  },
  async run(params: ToolRunParams): Promise<ToolRunResult> {
    const suffix = buildSuffix("lighting-control", params);
    const finalPrompt = suffix ? `${params.prompt}。${suffix}` : params.prompt;
    const [w, h] = resolveImageDimensions(params.resolution, params.aspectRatio ?? "1:1");

    const result = await generateImages({
      prompt: finalPrompt,
      modelId: params.modelId,
      count: 1,
      resolution: params.resolution,
      aspectRatio: params.aspectRatio,
      referenceUrls: params.referenceUrls,
      userId: params.userId,
    });

    return {
      urls: result.urls,
      provider: "tool-lighting-control",
      width: w,
      height: h,
      variant: "lighting-control",
    };
  },
};

export const cameraControlProvider: ImageToolProvider = {
  name: "tool-camera-control",
  supports(toolId: string) {
    return toolId === "camera-control";
  },
  async run(params: ToolRunParams): Promise<ToolRunResult> {
    const suffix = buildSuffix("camera-control", params);
    const finalPrompt = suffix ? `${params.prompt}。${suffix}` : params.prompt;
    const [w, h] = resolveImageDimensions(params.resolution, params.aspectRatio ?? "1:1");

    const result = await generateImages({
      prompt: finalPrompt,
      modelId: params.modelId,
      count: 1,
      resolution: params.resolution,
      aspectRatio: params.aspectRatio,
      referenceUrls: params.referenceUrls,
      userId: params.userId,
    });

    return {
      urls: result.urls,
      provider: "tool-camera-control",
      width: w,
      height: h,
      variant: "camera-control",
    };
  },
};

/** 检测工具 ID 是否由本文件处理（用于 registry 单元测试 / 健康检查） */
export function isLightingCameraToolId(toolId: string): boolean {
  return TOOL_IDS.has(toolId);
}
