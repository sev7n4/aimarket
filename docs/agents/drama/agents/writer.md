# Agent: writer（编剧）

| 字段 | 值 |
|------|-----|
| id | `writer` |
| layer | L2 Plan |
| order | 1 |
| 实现 | `apps/api/src/lib/drama/planner/agents/writer.ts` |
| schema | `WRITER_JSON_SCHEMA` |

---

## Role / Goal / Backstory

| 维度 | 定义 |
|------|------|
| **Role** | AI 短剧专职编剧 |
| **Goal** | 从用户梗概产出可拍摄的剧本结构与分镜骨架 |
| **Backstory** | 熟悉竖屏短剧 pacing；擅长 2–5 幕结构与 8–15 镜拆分 |

---

## 输入（User Prompt 构成）

| 来源 | 字段 |
|------|------|
| `PlanDramaInput` | `userIdea` |
| `PlanningContext` | `duration`, `aspectRatio` |
| refine | `refineGuidance(ctx)` 可选 |

---

## 输出（Commit JSON）

| 字段 | 说明 |
|------|------|
| `title` | 片名 |
| `logline` | 一句话梗概 |
| `acts[]` | 幕：act, sceneId, summary, emotion? |
| `narratorLines[]` | 旁白文案 |
| `scenes[]` | 1–4 场：id, name, location, atmosphere, promptAnchor |
| `shots[]` | **8–15 镜骨架**：id, order, sceneId, characterIds, dialogue |

### 本步 deliberately 不产出

- `visualPrompt` / `cameraSpec` / `durationSec` — 留给 cinematographer / storyboard
- 角色 visualSignature — 留给 character

---

## System Prompt 规则（当前实现摘要）

1. acts 幕数由故事与时长推理（通常 2–5，禁止机械 3 幕）
2. scenes 与 acts 匹配，id 稳定如 `scene_1`
3. shots 仅骨架；`characterIds` 用 `char_1`, `char_2` 占位
4. 总时长约 `{duration}s`，画幅 `{aspectRatio}`
5. 只输出 JSON

---

## 约束与验收

| 约束 | schema / 业务 |
|------|---------------|
| shots 数量 | minItems 8, maxItems 15 |
| scenes | minItems 1 |
| id 前缀 | char_*, scene_*, shot_* 供下游对齐 |

**验收**：合并后 `dramaProjectSchema` acts 非空；shots.length ∈ [8,15]。

---

## 下游消费者

- **director**：acts 情绪、场景名
- **character**：shots 中 characterIds 并集
- **cinematographer**：shots id 列表
- **storyboard**：shots 骨架 + dialogue

---

## 演进备注

- replicateProfile.beatStructure 可注入 userPrompt（backlog）
- persona 热更新：迁移至 manifest `agents.writer.systemPrompt`
