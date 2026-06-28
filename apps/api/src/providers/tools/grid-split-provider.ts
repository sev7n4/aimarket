/**
 * 宫格切分工具 Provider
 *
 * 将一张宫格图切分为 rows × cols 个独立图片，
 * 使用 Sharp 在服务端本地裁切后上传到对象存储。
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import { saveGeneratedImage } from "../../lib/storage.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

/** 从 prompt 中解析行列数，格式如 "宫格切分 3×3" 或 "3x3" */
function parseGridSize(prompt: string): { rows: number; cols: number } {
  // 匹配 "3×3" / "3x3" / "3＊3" 等格式
  const match = prompt.match(/(\d+)\s*[×x＊*]\s*(\d+)/);
  if (match) {
    const rows = Math.min(5, Math.max(2, Number(match[1])));
    const cols = Math.min(5, Math.max(2, Number(match[2])));
    return { rows, cols };
  }
  // 默认 3×3
  return { rows: 3, cols: 3 };
}

/** 下载远程图片到临时文件 */
async function downloadToTemp(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    throw new Error(`下载源图失败 (${res.status})`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const tmpPath = path.join(os.tmpdir(), `grid-split-src-${Date.now()}.tmp`);
  await fs.promises.writeFile(tmpPath, buffer);
  return tmpPath;
}

export const gridSplitToolProvider: ImageToolProvider = {
  name: "tool-grid-split",
  supports(toolId: string) {
    return toolId === "grid-split";
  },
  async run(params: ToolRunParams): Promise<ToolRunResult> {
    const imageUrl = params.referenceUrls[0];
    if (!imageUrl) {
      throw new Error("grid-split 需要一张源图片");
    }

    const { rows, cols } = parseGridSize(params.prompt);

    // 下载源图到临时文件
    const tmpPath = await downloadToTemp(imageUrl);
    try {
      // 获取图片尺寸
      const meta = await sharp(tmpPath).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      if (width === 0 || height === 0) {
        throw new Error("无法获取源图尺寸");
      }

      // 计算每个格子宽高
      const cellWidth = Math.floor(width / cols);
      const cellHeight = Math.floor(height / rows);
      if (cellWidth === 0 || cellHeight === 0) {
        throw new Error(`图片尺寸 (${width}×${height}) 不足以切分为 ${rows}×${cols}`);
      }

      // 按行优先切分每个格子
      const urls: string[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const left = c * cellWidth;
          const top = r * cellHeight;
          // 最后一列/行兜底到图片右/下边界
          const w = c === cols - 1 ? width - left : cellWidth;
          const h = r === rows - 1 ? height - top : cellHeight;

          const cellBuf = await sharp(tmpPath)
            .extract({ left, top, width: w, height: h })
            .png()
            .toBuffer();

          const saved = await saveGeneratedImage(cellBuf, "image/png");
          urls.push(saved.url);
        }
      }

      return {
        urls,
        provider: "tool-grid-split",
        width: cellWidth,
        height: cellHeight,
      };
    } finally {
      // 清理临时文件
      await fs.promises.unlink(tmpPath).catch(() => {});
    }
  },
};
