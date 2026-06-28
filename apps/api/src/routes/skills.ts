/**
 * Skill 市场发布/浏览 API
 * - POST /skills/publish — 接收 skill.yaml 内容，校验后存储
 * - GET /skills/marketplace — 返回已发布的 Skill 列表（分页）
 *
 * 简化：使用内存 Map 存储
 */
import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AuthVariables } from "../middleware/auth.js";
import { parse as parseYaml } from "yaml";

// ─── 内联 Skill 校验（避免 workspace 依赖问题） ──────────────

const skillStepSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string().min(1), type: z.literal("generate_set"), label: z.string().min(1) }),
  z.object({ id: z.string().min(1), type: z.literal("tool"), toolId: z.string().min(1), label: z.string().min(1), sourceStep: z.string().min(1), sourceOutputIndex: z.number().int().min(0).default(0) }),
  z.object({ id: z.string().min(1), type: z.literal("video"), label: z.string().min(1), sourceStep: z.string().min(1), modelId: z.string().default("seedance-2"), resolution: z.enum(["1k", "2k"]).default("1k"), aspectRatio: z.string().default("9:16") }),
  z.object({ id: z.string().min(1), type: z.literal("music_gen"), label: z.string().min(1), options: z.object({ defaultBpm: z.number().optional(), defaultDurationSec: z.number().optional() }).optional() }),
  z.object({ id: z.string().min(1), type: z.literal("character_refs"), label: z.string().min(1) }),
  z.object({ id: z.string().min(1), type: z.literal("scene_refs"), label: z.string().min(1) }),
  z.object({ id: z.string().min(1), type: z.literal("keyframe_batch"), label: z.string().min(1), sourceSteps: z.array(z.string()).optional(), audit: z.object({ characterMinScore: z.number().min(0).max(100).default(75), styleMinScore: z.number().min(0).max(100).default(70), maxRetries: z.number().int().min(0).max(5).default(2) }).optional() }),
  z.object({ id: z.string().min(1), type: z.literal("shot_video_batch"), label: z.string().min(1), sourceStep: z.string().min(1) }),
  z.object({ id: z.string().min(1), type: z.literal("tts_batch"), label: z.string().min(1) }),
  z.object({ id: z.string().min(1), type: z.literal("lipsync_batch"), label: z.string().min(1), sourceSteps: z.array(z.string()).optional() }),
  z.object({ id: z.string().min(1), type: z.literal("concat"), label: z.string().min(1), sourceStep: z.string().min(1).optional(), sourceSteps: z.array(z.string()).optional(), options: z.object({ subtitles: z.boolean().default(true), bgm: z.boolean().optional() }).optional() }),
]);

const InlineSkillSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string().optional(),
  confirmIfPointsOver: z.number().int().min(0).default(80),
  steps: z.array(skillStepSchema).min(1),
});

function validateSkill(yamlContent: string): { valid: boolean; errors?: string[] } {
  let parsed: unknown;
  try { parsed = parseYaml(yamlContent); } catch (e) {
    return { valid: false, errors: [`YAML 解析失败: ${(e as Error).message}`] };
  }
  const result = InlineSkillSchema.safeParse(parsed);
  if (result.success) return { valid: true };
  return { valid: false, errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`) };
}

// ─── 内存存储 ─────────────────────────────

interface PublishedSkill {
  id: string;
  skillId: string;
  name: string;
  description: string;
  version: number;
  yaml: string;
  authorId: string;
  createdAt: string;
}

const skillStore = new Map<string, PublishedSkill>();

// ─── 路由 ─────────────────────────────

export const skillMarketplace = new Hono<{ Variables: AuthVariables }>();

/** POST /skills/publish — 发布 Skill */
skillMarketplace.post("/publish", async (c) => {
  const userId = c.get("userId");
  const body = z
    .object({
      yaml: z.string().min(10).max(20000),
    })
    .parse(await c.req.json());

  // 使用 @aimarket/skill-schema 校验 YAML
  const result = validateSkill(body.yaml);
  if (!result.valid) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Skill YAML 校验失败",
          details: result.errors,
        },
      },
      400,
    );
  }

  // 解析 YAML 获取元数据
  const parsed = parseYaml(body.yaml) as {
    id: string;
    name: string;
    description?: string;
    version: number;
  };

  const id = randomUUID();
  const skill: PublishedSkill = {
    id,
    skillId: parsed.id,
    name: parsed.name,
    description: parsed.description ?? "",
    version: parsed.version,
    yaml: body.yaml,
    authorId: userId,
    createdAt: new Date().toISOString(),
  };

  skillStore.set(id, skill);

  return c.json(
    {
      data: {
        id: skill.id,
        skillId: skill.skillId,
        name: skill.name,
        description: skill.description,
        version: skill.version,
        createdAt: skill.createdAt,
      },
    },
    201,
  );
});

/** GET /skills/marketplace — 浏览已发布 Skill 列表（分页） */
skillMarketplace.get("/marketplace", (c) => {
  const pageNum = Math.max(1, Number(c.req.query("pageNum") ?? "1"));
  const pageSize = Math.min(50, Math.max(1, Number(c.req.query("pageSize") ?? "20")));
  const offset = (pageNum - 1) * pageSize;

  const all = Array.from(skillStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const total = all.length;
  const items = all.slice(offset, offset + pageSize).map((s) => ({
    id: s.id,
    skillId: s.skillId,
    name: s.name,
    description: s.description,
    version: s.version,
    createdAt: s.createdAt,
  }));

  return c.json({ data: items, total, pageNum, pageSize });
});
