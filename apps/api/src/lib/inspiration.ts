import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db/index.js";
import { getModel } from "./models.js";
import { AppError } from "./errors.js";
import { toPublicAssetUrl } from "./public-url.js";

export const inspirationVariableSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  default: z.string(),
});

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
  created_at: string;
  updated_at: string;
}

export interface ReferenceAsset {
  url: string;
  fileName?: string;
  assetId?: string;
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

export function rowToCanonical(row: InspirationRow) {
  const variables = parseVariables(row.variables_json);
  const referenceAssets = parseReferenceAssets(
    row.reference_assets_json,
    row.cover_url,
  );
  const prompt = renderPromptTemplate(row.prompt_template, variables);

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
    coverUrl: row.cover_url,
    referenceAssets,
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
    const row = db
      .prepare(
        `SELECT j.user_id FROM job_outputs o
         JOIN generation_jobs j ON j.id = o.job_id
         WHERE o.id = ?`,
      )
      .get(source.outputId) as { user_id: string } | undefined;
    if (!row || row.user_id !== userId) {
      throw new AppError(403, "FORBIDDEN", "无权发布该图片");
    }
    return;
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

/** 用户从画布发布到灵感发现（prompt 写入模板，供「制作同款」灌入工作台） */
export function createUserPublishedInspiration(
  userId: string,
  input: {
    coverUrl: string;
    prompt: string;
    title?: string;
    modelId?: string;
    aspectRatio?: string;
    resolution?: string;
    referenceUrls?: string[];
    outputId?: string;
    assetId?: string;
  },
) {
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new AppError(400, "VALIDATION_ERROR", "提示词不能为空");
  }

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

  const coverUrl = toPublicAssetUrl(input.coverUrl);
  if (!/^https?:\/\//i.test(coverUrl)) {
    throw new AppError(400, "VALIDATION_ERROR", "封面图地址无效");
  }

  const modelId = input.modelId?.trim() || "seedream-5";
  assertValidModelId(modelId);

  const aspectRatio = input.aspectRatio?.trim() || "auto";
  const resolution =
    input.resolution === "2k" || input.resolution === "4k"
      ? input.resolution
      : "1k";

  const refs = JSON.stringify(
    (input.referenceUrls ?? [])
      .map((url) => ({ url: toPublicAssetUrl(url) }))
      .filter((item) => /^https?:\/\//i.test(item.url)),
  );

  const id = randomUUID();
  const maxLegacy = db
    .prepare("SELECT COALESCE(MAX(legacy_id), 0) as m FROM inspiration_templates")
    .get() as { m: number };
  const legacyId = maxLegacy.m + 1;
  const title = truncateTitle(input.title ?? prompt);
  const sortOrder = -legacyId;

  db.prepare(
    `INSERT INTO inspiration_templates (
      id, legacy_id, title, category, prompt_template, variables_json,
      model_id, aspect_ratio, resolution, cover_url, reference_assets_json,
      status, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    legacyId,
    title,
    "创意",
    prompt,
    null,
    modelId,
    aspectRatio,
    resolution,
    coverUrl,
    refs === "[]" ? JSON.stringify([{ url: coverUrl }]) : refs,
    "published",
    sortOrder,
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
