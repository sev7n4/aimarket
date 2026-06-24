import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db/index.js";
import { getModel } from "./models.js";
import { AppError } from "./errors.js";
import { extractPublishablePrompt } from "./references.js";
import { toPublicAssetUrl } from "./public-url.js";
import {
  extractVideoPosterFrame,
  isSuspectNonPlayableVideoUrl,
  isVideoMediaUrl,
  rehostRemoteVideo,
} from "./video-poster.js";

export const inspirationVariableSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  default: z.string(),
});

export const dramaTemplateMetadataSchema = z.object({
  userIdea: z.string().min(10).max(2000),
  projectType: z.enum(["short_drama", "mv", "creative"]).default("short_drama"),
  targetDurationSec: z.number().int().min(60).max(180).optional(),
  aspectRatio: z.enum(["9:16", "16:9"]).optional(),
  scriptTitle: z.string().max(200).optional(),
  logline: z.string().max(500).optional(),
});

export type DramaTemplateMetadata = z.infer<typeof dramaTemplateMetadataSchema>;

export type InspirationVariable = z.infer<typeof inspirationVariableSchema>;

export interface InspirationRow {
  id: string;
  legacy_id: number;
  title: string;
  category: string;
  prompt_template: string;
  variables_json: string | null;
  model_id: string;
  aspect_ratio: string;
  resolution: string;
  cover_url: string;
  reference_assets_json: string | null;
  status: string;
  sort_order: number;
  published_by_user_id?: string | null;
  source_output_id?: string | null;
  source_asset_id?: string | null;
  drama_template_json?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReferenceAsset {
  url: string;
  fileName?: string;
  assetId?: string;
}

function parseDramaTemplate(
  json: string | null | undefined,
): DramaTemplateMetadata | undefined {
  if (!json) return undefined;
  try {
    return dramaTemplateMetadataSchema.parse(JSON.parse(json));
  } catch {
    return undefined;
  }
}

export function parseDramaTemplateMetadata(
  json: string | null | undefined,
): DramaTemplateMetadata | undefined {
  return parseDramaTemplate(json);
}

function parseVariables(json: string | null): InspirationVariable[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return z.array(inspirationVariableSchema).parse(parsed);
  } catch {
    return [];
  }
}

function parseReferenceAssets(
  json: string | null,
  coverUrl: string,
): ReferenceAsset[] {
  let list: ReferenceAsset[] = [];
  if (json) {
    try {
      const parsed = JSON.parse(json) as ReferenceAsset[];
      if (Array.isArray(parsed)) {
        list = parsed.filter((a) => typeof a.url === "string" && a.url.length > 0);
      }
    } catch {
      list = [];
    }
  }
  if (list.length === 0 && coverUrl) {
    return [{ url: coverUrl }];
  }
  return list;
}

/** 将模板 + 变量渲染为最终 prompt（兼容椒图 {argument name=...} 原样保留） */
export function renderPromptTemplate(
  template: string,
  variables: InspirationVariable[],
): string {
  let out = template;
  for (const v of variables) {
    const patterns = [
      new RegExp(`\\{\\{${v.key}\\}\\}`, "g"),
      new RegExp(
        `\\{argument name="${v.key}"[^}]*default="([^"]*)"[^}]*\\}`,
        "g",
      ),
    ];
    for (const p of patterns) {
      out = out.replace(p, (_, def?: string) => v.default || def || "");
    }
  }
  return out;
}

function resolveInspirationVideoUrl(
  coverUrl: string,
  mediaType: "image" | "video",
  referenceAssets: ReferenceAsset[],
): string | undefined {
  if (mediaType !== "video") return undefined;
  const fromRefs = referenceAssets.find(
    (a) => isVideoMediaUrl(a.url) && !isSuspectNonPlayableVideoUrl(a.url),
  )?.url;
  if (fromRefs) return toPublicAssetUrl(fromRefs);
  if (isVideoMediaUrl(coverUrl) && !isSuspectNonPlayableVideoUrl(coverUrl)) {
    return toPublicAssetUrl(coverUrl);
  }
  return undefined;
}

export function rowToCanonical(row: InspirationRow) {
  const variables = parseVariables(row.variables_json);
  const referenceAssets = parseReferenceAssets(
    row.reference_assets_json,
    row.cover_url,
  );
  const prompt = renderPromptTemplate(row.prompt_template, variables);
  const mediaType = getModel(row.model_id)?.type === "video" ? "video" : "image";
  let coverUrl = toPublicAssetUrl(row.cover_url);
  const videoUrl = resolveInspirationVideoUrl(
    coverUrl,
    mediaType,
    referenceAssets,
  );
  const dramaTemplate = parseDramaTemplate(row.drama_template_json);

  if (
    mediaType === "video" &&
    isVideoMediaUrl(coverUrl) &&
    isSuspectNonPlayableVideoUrl(coverUrl)
  ) {
    coverUrl = "";
  }

  return {
    id: row.id,
    title: row.title,
    category: row.category,
    promptTemplate: row.prompt_template,
    variables: variables.length ? variables : undefined,
    prompt,
    modelId: row.model_id,
    aspectRatio: row.aspect_ratio,
    resolution: row.resolution,
    coverUrl,
    referenceAssets,
    mediaType,
    videoUrl,
    status: row.status,
    sortOrder: row.sort_order,
    publishedByUserId: row.published_by_user_id ?? undefined,
    sourceOutputId: row.source_output_id ?? undefined,
    sourceAssetId: row.source_asset_id ?? undefined,
    dramaTemplate,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 发布前：视频灵感用抽帧 poster 作封面，原视频写入 reference */
export async function normalizeInspirationCoverForPublish(opts: {
  coverUrl: string;
  thumbUrl?: string;
  modelId: string;
  referenceUrls: string[];
}): Promise<{ coverUrl: string; referenceUrls: string[] }> {
  const model = getModel(opts.modelId);
  const isVideo =
    model?.type === "video" || isVideoMediaUrl(opts.coverUrl);
  if (!isVideo) {
    return {
      coverUrl: opts.coverUrl,
      referenceUrls: opts.referenceUrls,
    };
  }

  let videoUrl = toPublicAssetUrl(opts.coverUrl);
  if (isSuspectNonPlayableVideoUrl(videoUrl)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "视频源地址无效，无法发布到灵感发现",
    );
  }

  const rehosted = await rehostRemoteVideo(videoUrl);
  videoUrl = rehosted.url;

  const thumb = opts.thumbUrl ? toPublicAssetUrl(opts.thumbUrl) : "";
  let posterUrl = thumb && !isVideoMediaUrl(thumb) ? thumb : "";
  if (!posterUrl) {
    const poster = await extractVideoPosterFrame(videoUrl);
    posterUrl = poster.url;
  }

  const refSet = new Set(
    opts.referenceUrls.map((u) => toPublicAssetUrl(u)).filter(Boolean),
  );
  refSet.add(videoUrl);
  return {
    coverUrl: posterUrl,
    referenceUrls: [...refSet],
  };
}

/** 历史数据：cover 仍为视频 URL 时抽帧并回写 DB（一次性修复） */
export async function ensureInspirationRowCover(
  row: InspirationRow,
): Promise<InspirationRow> {
  const model = getModel(row.model_id);
  if (model?.type !== "video") return row;
  if (!isVideoMediaUrl(row.cover_url)) return row;
  if (isSuspectNonPlayableVideoUrl(row.cover_url)) return row;

  try {
    const rehosted = await rehostRemoteVideo(row.cover_url);
    const poster = await extractVideoPosterFrame(rehosted.url);
    const videoUrl = rehosted.url;
    const refs = parseReferenceAssets(row.reference_assets_json, row.cover_url);
    const merged = [
      { url: videoUrl },
      ...refs.filter((r) => r.url !== videoUrl),
    ];
    db.prepare(
      `UPDATE inspiration_templates
       SET cover_url = ?, reference_assets_json = ?, updated_at = datetime('now')
       WHERE id = ?`,
    ).run(poster.url, JSON.stringify(merged), row.id);
    const updated = db
      .prepare("SELECT * FROM inspiration_templates WHERE id = ?")
      .get(row.id) as unknown as InspirationRow | undefined;
    return updated ?? row;
  } catch {
    return row;
  }
}

/** 椒图 keyword/detail 兼容形状 */
export function rowToKeywordDetail(row: InspirationRow) {
  const canonical = rowToCanonical(row);
  const imagesList = canonical.referenceAssets.map((a) => ({
    url: a.url,
    fileName: a.fileName,
    ossId: a.assetId,
  }));

  return {
    id: row.legacy_id,
    keywords: row.title,
    prompt: canonical.prompt,
    modelId: row.model_id,
    size: row.aspect_ratio,
    qualityLevel: row.resolution.toUpperCase(),
    picture: row.cover_url,
    imagesList,
    isMapping: false,
  };
}

export function rowToKeywordListItem(row: InspirationRow) {
  return {
    id: row.legacy_id,
    keywords: row.title,
    picture: row.cover_url,
    createTime: row.created_at,
    updateTime: row.updated_at,
  };
}

export function getInspirationRowById(id: string) {
  const row = db
    .prepare(`SELECT * FROM inspiration_templates WHERE id = ?`)
    .get(id) as InspirationRow | undefined;
  if (!row) {
    throw new AppError(404, "NOT_FOUND", "灵感不存在");
  }
  return row;
}

export function getPublishedInspirationById(id: string) {
  const row = db
    .prepare(
      `SELECT * FROM inspiration_templates
       WHERE id = ? AND status = 'published'`,
    )
    .get(id) as InspirationRow | undefined;
  if (!row) {
    throw new AppError(404, "NOT_FOUND", "灵感不存在");
  }
  return row;
}

export function getPublishedInspirationByLegacyId(legacyId: number) {
  const row = db
    .prepare(
      `SELECT * FROM inspiration_templates
       WHERE legacy_id = ? AND status = 'published'`,
    )
    .get(legacyId) as InspirationRow | undefined;
  if (!row) {
    throw new AppError(404, "NOT_FOUND", "灵感不存在");
  }
  return row;
}

export function listPublishedInspirations(opts: {
  pageNum: number;
  pageSize: number;
  category?: string;
  /** 首页扇形套图：仅返回 id 以 apparel- 开头的服饰高频场景 */
  fanSet?: "apparel";
}) {
  const offset = (opts.pageNum - 1) * opts.pageSize;
  const params: (string | number)[] = [];
  let where = "WHERE status = 'published'";
  if (opts.fanSet === "apparel") {
    where += " AND id LIKE 'apparel-%'";
  } else if (opts.category && opts.category !== "全部") {
    where += " AND category = ?";
    params.push(opts.category);
  }

  const totalRow = db
    .prepare(`SELECT COUNT(*) as c FROM inspiration_templates ${where}`)
    .get(...params) as { c: number };

  const rows = db
    .prepare(
      `SELECT * FROM inspiration_templates ${where}
       ORDER BY sort_order ASC, legacy_id ASC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, opts.pageSize, offset) as unknown as InspirationRow[];

  return { total: totalRow.c, rows };
}

export function listUserPublishedInspirations(
  userId: string,
  opts: { pageNum: number; pageSize: number },
) {
  const offset = (opts.pageNum - 1) * opts.pageSize;
  const totalRow = db
    .prepare(
      `SELECT COUNT(*) as c FROM inspiration_templates
       WHERE published_by_user_id = ? AND status = 'published'`,
    )
    .get(userId) as { c: number };

  const rows = db
    .prepare(
      `SELECT * FROM inspiration_templates
       WHERE published_by_user_id = ? AND status = 'published'
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(userId, opts.pageSize, offset) as unknown as InspirationRow[];

  return { total: totalRow.c, rows };
}

function findActivePublishedBySource(
  userId: string,
  source: { outputId?: string; assetId?: string },
) {
  if (source.outputId) {
    return db
      .prepare(
        `SELECT id FROM inspiration_templates
         WHERE published_by_user_id = ? AND source_output_id = ? AND status = 'published'`,
      )
      .get(userId, source.outputId) as { id: string } | undefined;
  }
  if (source.assetId) {
    return db
      .prepare(
        `SELECT id FROM inspiration_templates
         WHERE published_by_user_id = ? AND source_asset_id = ? AND status = 'published'`,
      )
      .get(userId, source.assetId) as { id: string } | undefined;
  }
  return undefined;
}

export function assertUserOwnsPublishedInspiration(userId: string, id: string) {
  const row = getInspirationRowById(id);
  if (row.published_by_user_id !== userId) {
    throw new AppError(403, "FORBIDDEN", "无权操作该灵感");
  }
  return row;
}

/** 用户撤回画廊发布（软删 status=archived） */
export function archiveUserPublishedInspiration(userId: string, id: string) {
  const row = assertUserOwnsPublishedInspiration(userId, id);
  if (row.status !== "published") {
    throw new AppError(409, "CONFLICT", "该灵感已撤回");
  }
  db.prepare(
    `UPDATE inspiration_templates
     SET status = 'archived', updated_at = datetime('now')
     WHERE id = ?`,
  ).run(id);
  return { id, status: "archived" as const };
}

/** Admin / 运维：归档任意灵感（含历史无发布者记录） */
export function archiveInspirationById(id: string) {
  const row = getInspirationRowById(id);
  if (row.status === "archived") {
    throw new AppError(409, "CONFLICT", "该灵感已归档");
  }
  db.prepare(
    `UPDATE inspiration_templates
     SET status = 'archived', updated_at = datetime('now')
     WHERE id = ?`,
  ).run(id);
  return { id, status: "archived" as const };
}

export function assertValidModelId(modelId: string) {
  if (!getModel(modelId)) {
    throw new AppError(400, "VALIDATION_ERROR", `未知模型: ${modelId}`);
  }
}

/** 合并用户填写的槽位值到模板变量 */
export function mergeVariableValues(
  defaults: InspirationVariable[],
  overrides: Record<string, string> | undefined,
): InspirationVariable[] {
  if (!overrides || !Object.keys(overrides).length) return defaults;
  return defaults.map((v) => ({
    ...v,
    default: overrides[v.key]?.trim() || v.default,
  }));
}

function truncateTitle(text: string, max = 60) {
  const trimmed = text.trim();
  if (!trimmed) return "创作者灵感";
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function assertUserOwnsCanvasSource(
  userId: string,
  source: { outputId?: string; assetId?: string },
) {
  if (source.outputId) {
    const fromJob = db
      .prepare(
        `SELECT j.user_id FROM job_outputs o
         JOIN generation_jobs j ON j.id = o.job_id
         WHERE o.id = ?`,
      )
      .get(source.outputId) as { user_id: string } | undefined;
    if (fromJob?.user_id === userId) return;

    const fromMessage = db
      .prepare(
        `SELECT s.user_id FROM message_outputs mo
         JOIN messages m ON m.id = mo.message_id
         JOIN image_sessions s ON s.id = m.session_id
         WHERE mo.id = ?`,
      )
      .get(source.outputId) as { user_id: string } | undefined;
    if (fromMessage?.user_id === userId) return;

    throw new AppError(403, "FORBIDDEN", "无权发布该图片");
  }
  if (source.assetId) {
    const row = db
      .prepare("SELECT user_id FROM assets WHERE id = ?")
      .get(source.assetId) as { user_id: string } | undefined;
    if (!row || row.user_id !== userId) {
      throw new AppError(403, "FORBIDDEN", "无权发布该图片");
    }
  }
}

type PublishJobContext = {
  referenceUrls?: string[];
};

function parseJobToolContext(raw: string | null): PublishJobContext | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PublishJobContext & {
      referenceUrls?: unknown;
    };
    const urls = Array.isArray(parsed.referenceUrls)
      ? parsed.referenceUrls.filter(
          (url): url is string => typeof url === "string" && url.length > 0,
        )
      : [];
    return urls.length ? { referenceUrls: urls } : null;
  } catch {
    return null;
  }
}

/** 从画布 outputId 解析真实生成参数（不信任前端 batchTitle / 拼接 prompt） */
export function resolveCanvasOutputPublishMeta(
  userId: string,
  outputId: string,
) {
  const fromMessage = db
    .prepare(
      `SELECT mo.url, mo.thumb_url, j.prompt AS job_prompt, j.model_id, j.resolution,
              j.aspect_ratio, j.tool_context, u.content AS user_prompt
       FROM message_outputs mo
       JOIN messages a ON a.id = mo.message_id
       JOIN generation_jobs j ON j.id = a.job_id
       JOIN image_sessions s ON s.id = a.session_id
       LEFT JOIN messages u ON u.job_id = j.id AND u.role = 'user'
       WHERE mo.id = ? AND s.user_id = ?`,
    )
    .get(outputId, userId) as
    | {
        url: string;
        thumb_url: string | null;
        job_prompt: string | null;
        model_id: string | null;
        resolution: string | null;
        aspect_ratio: string | null;
        tool_context: string | null;
        user_prompt: string | null;
      }
    | undefined;

  if (fromMessage) {
    const stored = fromMessage.user_prompt ?? fromMessage.job_prompt ?? "";
    const extracted = extractPublishablePrompt(stored);
    const toolRefs =
      parseJobToolContext(fromMessage.tool_context)?.referenceUrls ?? [];
    const referenceUrls = [
      ...new Set([...extracted.referenceUrls, ...toolRefs]),
    ].map(toPublicAssetUrl);

    return {
      prompt: extracted.prompt,
      modelId: fromMessage.model_id ?? "seedream-5",
      aspectRatio: fromMessage.aspect_ratio ?? "auto",
      resolution:
        fromMessage.resolution === "2k" || fromMessage.resolution === "4k"
          ? fromMessage.resolution
          : ("1k" as const),
      coverUrl: toPublicAssetUrl(fromMessage.url),
      thumbUrl: fromMessage.thumb_url
        ? toPublicAssetUrl(fromMessage.thumb_url)
        : undefined,
      referenceUrls,
    };
  }

  const fromJobOutput = db
    .prepare(
      `SELECT o.url, o.thumb_url, j.prompt AS job_prompt, j.model_id, j.resolution,
              j.aspect_ratio, j.tool_context, u.content AS user_prompt
       FROM job_outputs o
       JOIN generation_jobs j ON j.id = o.job_id
       LEFT JOIN messages u ON u.job_id = j.id AND u.role = 'user'
       WHERE o.id = ? AND j.user_id = ?`,
    )
    .get(outputId, userId) as
    | {
        url: string;
        thumb_url: string | null;
        job_prompt: string | null;
        model_id: string | null;
        resolution: string | null;
        aspect_ratio: string | null;
        tool_context: string | null;
        user_prompt: string | null;
      }
    | undefined;

  if (!fromJobOutput) {
    throw new AppError(404, "NOT_FOUND", "找不到该图片的生成记录");
  }

  const stored = fromJobOutput.user_prompt ?? fromJobOutput.job_prompt ?? "";
  const extracted = extractPublishablePrompt(stored);
  const toolRefs =
    parseJobToolContext(fromJobOutput.tool_context)?.referenceUrls ?? [];

  return {
    prompt: extracted.prompt,
    modelId: fromJobOutput.model_id ?? "seedream-5",
    aspectRatio: fromJobOutput.aspect_ratio ?? "auto",
    resolution:
      fromJobOutput.resolution === "2k" || fromJobOutput.resolution === "4k"
        ? fromJobOutput.resolution
        : ("1k" as const),
    coverUrl: toPublicAssetUrl(fromJobOutput.url),
    thumbUrl: fromJobOutput.thumb_url
      ? toPublicAssetUrl(fromJobOutput.thumb_url)
      : undefined,
    referenceUrls: [
      ...new Set([...extracted.referenceUrls, ...toolRefs]),
    ].map(toPublicAssetUrl),
  };
}

/** 用户从画布发布到灵感发现（prompt 写入模板，供「制作同款」灌入工作台） */
export async function createUserPublishedInspiration(
  userId: string,
  input: {
    coverUrl?: string;
    prompt?: string;
    title?: string;
    modelId?: string;
    aspectRatio?: string;
    resolution?: string;
    referenceUrls?: string[];
    outputId?: string;
    assetId?: string;
    dramaTemplate?: DramaTemplateMetadata;
  },
) {
  if (!input.outputId && !input.assetId) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "请提供 outputId 或 assetId 以校验发布权限",
    );
  }
  assertUserOwnsCanvasSource(userId, {
    outputId: input.outputId,
    assetId: input.assetId,
  });

  const existing = findActivePublishedBySource(userId, {
    outputId: input.outputId,
    assetId: input.assetId,
  });
  if (existing) {
    throw new AppError(409, "CONFLICT", "该画布产出已发布到灵感发现");
  }

  const resolved = input.outputId
    ? resolveCanvasOutputPublishMeta(userId, input.outputId)
    : null;

  const prompt = (
    resolved?.prompt ||
    input.prompt?.trim() ||
    ""
  ).trim();
  if (!prompt) {
    throw new AppError(400, "VALIDATION_ERROR", "提示词不能为空");
  }

  let coverUrl = toPublicAssetUrl(
    input.coverUrl?.trim() || resolved?.coverUrl || "",
  );
  if (!/^https?:\/\//i.test(coverUrl)) {
    throw new AppError(400, "VALIDATION_ERROR", "封面图地址无效");
  }

  const modelId = resolved?.modelId || input.modelId?.trim() || "seedream-5";
  assertValidModelId(modelId);

  const aspectRatio =
    resolved?.aspectRatio || input.aspectRatio?.trim() || "auto";
  const resolution =
    resolved?.resolution ||
    (input.resolution === "2k" || input.resolution === "4k"
      ? input.resolution
      : "1k");

  const mergedRefs = [
    ...new Set([
      ...(resolved?.referenceUrls ?? []),
      ...(input.referenceUrls ?? []),
    ]),
  ];

  const normalized = await normalizeInspirationCoverForPublish({
    coverUrl,
    thumbUrl: resolved?.thumbUrl,
    modelId,
    referenceUrls: mergedRefs,
  });
  coverUrl = normalized.coverUrl;
  const refs = JSON.stringify(
    normalized.referenceUrls
      .map((url) => ({ url: toPublicAssetUrl(url) }))
      .filter((item) => /^https?:\/\//i.test(item.url)),
  );

  const id = randomUUID();
  const maxLegacy = db
    .prepare("SELECT COALESCE(MAX(legacy_id), 0) as m FROM inspiration_templates")
    .get() as { m: number };
  const legacyId = maxLegacy.m + 1;
  const title = truncateTitle(input.title?.trim() || "创作者灵感");
  const sortOrder = -legacyId;
  const category = input.dramaTemplate ? "制片" : "创意";
  const dramaTemplateJson = input.dramaTemplate
    ? JSON.stringify(dramaTemplateMetadataSchema.parse(input.dramaTemplate))
    : null;

  db.prepare(
    `INSERT INTO inspiration_templates (
      id, legacy_id, title, category, prompt_template, variables_json,
      model_id, aspect_ratio, resolution, cover_url, reference_assets_json,
      status, sort_order, published_by_user_id, source_output_id, source_asset_id,
      drama_template_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    legacyId,
    title,
    category,
    prompt,
    null,
    modelId,
    aspectRatio,
    resolution,
    coverUrl,
    refs === "[]" ? JSON.stringify([{ url: coverUrl }]) : refs,
    "published",
    sortOrder,
    userId,
    input.outputId ?? null,
    input.assetId ?? null,
    dramaTemplateJson,
  );

  const row = db
    .prepare("SELECT * FROM inspiration_templates WHERE id = ?")
    .get(id);
  return rowToCanonical(row as unknown as InspirationRow);
}

export function renderInspirationWithVariables(
  row: InspirationRow,
  overrides?: Record<string, string>,
) {
  const base = rowToCanonical(row);
  const variables = mergeVariableValues(
    parseVariables(row.variables_json),
    overrides,
  );
  const prompt = renderPromptTemplate(row.prompt_template, variables);
  return {
    ...base,
    variables: variables.length ? variables : undefined,
    prompt,
  };
}
