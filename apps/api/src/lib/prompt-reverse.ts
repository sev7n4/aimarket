import { db } from "../db/index.js";
import { AppError } from "./errors.js";

const MOCK_PROMPTS = [
  "专业电商产品摄影，柔和布光，浅景深，主体居中，高清细节，商业广告质感",
  "极简白底产品图，均匀柔光，无杂乱阴影，适合主图与详情页",
  "生活方式场景图，自然光，温馨氛围，产品与场景和谐融合",
];

export function mockReversePrompt(imageHint?: string): string {
  const idx =
    imageHint ?
      Math.abs(
        [...imageHint].reduce((a, c) => a + c.charCodeAt(0), 0),
      ) % MOCK_PROMPTS.length
    : 0;
  return MOCK_PROMPTS[idx]!;
}

export function resolveImageUrlForReverse(input: {
  imageUrl?: string;
  assetId?: string;
  userId: string;
}): string {
  if (input.imageUrl?.trim()) return input.imageUrl.trim();

  if (input.assetId) {
    const asset = db
      .prepare("SELECT url FROM assets WHERE id = ? AND user_id = ?")
      .get(input.assetId, input.userId) as { url: string } | undefined;
    if (!asset) {
      throw new AppError(400, "INVALID_ASSET", "附件不存在");
    }
    if (asset.url.startsWith("pending:")) {
      throw new AppError(400, "INVALID_ASSET", "附件尚未完成上传");
    }
    return asset.url;
  }

  throw new AppError(
    400,
    "VALIDATION_ERROR",
    "请提供 imageUrl 或 assetId",
  );
}
