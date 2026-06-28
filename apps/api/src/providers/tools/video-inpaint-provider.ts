/**
 * 视频精准编辑 Provider（简化方案）
 *
 * 流程：
 * 1. 接收视频 URL + mask + 编辑 prompt + 关键帧时间戳
 * 2. 使用 ffmpeg 提取关键帧图片
 * 3. 对关键帧执行 inpaint（复用现有 editHttpProvider）
 * 4. 将编辑后的关键帧作为首帧，生成视频（复用现有 i2v 流程）
 * 5. 返回新视频
 */

import { execFile } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";
import { editHttpProvider } from "./edit-http.js";
import { editMockProvider } from "./edit-mock.js";
import { generateVideos } from "../video/registry.js";
import { persistOutputUrls } from "../../lib/persist-output.js";

/** video-inpaint 工具 ID */
const VIDEO_INPAINT_TOOL_ID = "video-inpaint";

/**
 * 使用 ffmpeg 提取视频指定时间戳的帧图片
 * @returns 提取帧图片的文件路径
 */
async function extractFrame(
  videoUrl: string,
  timestampSec: number,
  outputDir: string,
): Promise<string> {
  const outputPath = join(outputDir, `frame_${Date.now()}.jpg`);
  const ts = formatTimestamp(timestampSec);

  return new Promise((resolve, reject) => {
    execFile(
      "ffmpeg",
      ["-y", "-ss", ts, "-i", videoUrl, "-frames:v", "1", "-q:v", "2", outputPath],
      { timeout: 30_000 },
      (err) => {
        if (err) return reject(new Error(`ffmpeg 提取帧失败: ${err.message}`));
        resolve(outputPath);
      },
    );
  });
}

/** 将秒数格式化为 HH:MM:SS.mmm */
function formatTimestamp(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
}

/**
 * 将 base64 data URL 写入临时文件
 */
async function writeDataUrlToFile(dataUrl: string, outputDir: string, filename: string): Promise<string> {
  const match = dataUrl.match(/^data:image\/(png|jpeg);base64,(.+)$/);
  if (!match) throw new Error("无效的 mask data URL 格式");
  const ext = match[1] === "png" ? "png" : "jpg";
  const buffer = Buffer.from(match[2], "base64");
  const filePath = join(outputDir, `${filename}.${ext}`);
  await writeFile(filePath, buffer);
  return filePath;
}

export const videoInpaintProvider: ImageToolProvider = {
  name: "video-inpaint",

  supports(toolId: string): boolean {
    return toolId === VIDEO_INPAINT_TOOL_ID;
  },

  async run(params: ToolRunParams): Promise<ToolRunResult> {
    const videoUrl = params.referenceUrls[0];
    if (!videoUrl) {
      throw new Error("video-inpaint 需要提供视频 URL 作为 referenceUrls[0]");
    }

    // 获取 mask 数据（从 toolContext）
    const mask = params.toolContext?.masks?.[0];
    const timestampSec = 0; // 简化：默认从首帧开始

    // 创建临时工作目录
    const workDir = join(tmpdir(), `vi-${randomUUID()}`);
    await mkdir(workDir, { recursive: true });

    try {
      // 步骤 1：使用 ffmpeg 提取关键帧
      const framePath = await extractFrame(videoUrl, timestampSec, workDir);

      // 步骤 2：构建 inpaint 参数，复用 editHttpProvider
      const inpaintParams: ToolRunParams = {
        toolId: "inpaint",
        prompt: params.prompt,
        modelId: params.modelId,
        resolution: params.resolution,
        aspectRatio: params.aspectRatio,
        referenceUrls: [framePath],
        toolContext: mask ? {
          toolId: "inpaint",
          masks: [{
            itemId: mask.itemId,
            mode: mask.mode,
            maskDataUrl: mask.maskDataUrl,
            bbox: mask.bbox,
            normalizedBbox: mask.normalizedBbox,
          }],
        } : undefined,
      };

      // 尝试使用 editHttpProvider，失败则降级到 mock
      let inpaintResult: ToolRunResult;
      try {
        inpaintResult = await editHttpProvider.run(inpaintParams);
      } catch {
        inpaintResult = await editMockProvider.run(inpaintParams);
      }

      if (!inpaintResult.urls?.[0]) {
        throw new Error("关键帧 inpaint 未返回结果");
      }

      // 步骤 3：将编辑后的关键帧作为首帧，生成视频（i2v）
      const editedFrameUrl = inpaintResult.urls[0];
      const videoResult = await generateVideos({
        prompt: params.prompt,
        modelId: params.modelId,
        count: 1,
        resolution: params.resolution,
        referenceUrls: [editedFrameUrl],
        durationSec: 5, // 默认生成 5 秒视频
      });

      const persistedUrls = await persistOutputUrls(videoResult.urls);

      return {
        urls: persistedUrls,
        provider: "video-inpaint",
        mimeType: "video/mp4",
        variant: "video-inpaint",
      };
    } finally {
      // 清理临时目录
      await rm(workDir, { recursive: true, force: true });
    }
  },
};
