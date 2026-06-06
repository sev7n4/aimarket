import { db } from "../db/index.js";
import { toPublicAssetUrl } from "./public-url.js";

export interface SessionReference {
  id: string;
  url: string;
  label: string;
  createdAt: string;
}

export function listSessionReferences(sessionId: string): SessionReference[] {
  const rows = db
    .prepare(
      `SELECT mo.id, mo.url, m.created_at
       FROM message_outputs mo
       JOIN messages m ON m.id = mo.message_id
       WHERE m.session_id = ? AND m.role = 'assistant'
       ORDER BY m.created_at DESC, mo.sort_order ASC
       LIMIT 30`,
    )
    .all(sessionId) as { id: string; url: string; created_at: string }[];

  return rows.map((row, index) => ({
    id: row.id,
    url: row.url,
    label: `生成图 ${rows.length - index}`,
    createdAt: row.created_at,
  }));
}

export function resolveReferenceUrls(outputIds: string[]): string[] {
  const urls: string[] = [];
  for (const id of outputIds) {
    const row = db
      .prepare("SELECT url FROM message_outputs WHERE id = ?")
      .get(id) as { url: string } | undefined;
    if (row) urls.push(toPublicAssetUrl(row.url));
  }
  return urls;
}

export function enrichPromptWithReferences(
  prompt: string,
  referenceUrls: string[],
): string {
  if (!referenceUrls.length) return prompt;
  const refs = referenceUrls
    .map((url, i) => `[引用图${i + 1}: ${url}]`)
    .join("\n");
  return `${prompt}\n\n${refs}`;
}

const I2I_INSTRUCTION =
  "【图生图约束】必须以参考图为主体，保持主体身份、构图与关键细节一致；仅在用户描述范围内做修改，禁止替换成无关场景或人物。";

/** 普通生成 / Seedream 图生图：强约束 + 引用 URL 标注 */
export function buildReferenceAwarePrompt(
  prompt: string,
  referenceUrls: string[],
): string {
  if (!referenceUrls.length) return prompt;
  return `${I2I_INSTRUCTION}\n\n${enrichPromptWithReferences(prompt, referenceUrls)}`;
}

const PUBLISH_PROMPT_CUT_MARKERS = [
  "\n\n[引用图",
  "\n[引用图",
  "\n【局部编辑区域】",
  "\n【焦点位置】",
  "\n【画面】",
] as const;

/** 从入库 prompt 还原用户可复用的创作提示词（去掉引用 URL、工具/蒙版等系统拼接） */
export function extractPublishablePrompt(stored: string): {
  prompt: string;
  referenceUrls: string[];
} {
  let text = stored.trim();
  const referenceUrls: string[] = [];
  if (!text) return { prompt: "", referenceUrls };

  const refLineRe = /\[引用图\d+:\s*([^\]]+)\]/g;
  for (const match of text.matchAll(refLineRe)) {
    const url = match[1]?.trim();
    if (url) referenceUrls.push(url);
  }

  text = text.replace(/^【图生图约束】[^\n]*\n\n?/, "");
  text = text.replace(/^【[^】]{1,24}】/, "");

  for (const marker of PUBLISH_PROMPT_CUT_MARKERS) {
    const idx = text.indexOf(marker);
    if (idx > 0) text = text.slice(0, idx);
  }

  text = text.replace(/\n\[引用图\d+:[^\]]+\]/g, "");
  text = text.replace(/（\d+x 放大）\s*$/, "");

  return {
    prompt: text.trim(),
    referenceUrls: [...new Set(referenceUrls)],
  };
}
