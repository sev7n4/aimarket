# Skill 包格式细则（AIMarket 扩展）

> **暂不排期**：本文档为架构预留；生产仍使用 `packages/agent-skills/skills/*.yaml`。  
> Anthropic 基线：[agentskills.io/specification](https://agentskills.io/specification)  
> Pipeline schema：`packages/agent-skills/src/schema.ts` · `@aimarket/skill-schema`

---

## 1. 目录布局

```
{skill-name}/                    # 必须与 SKILL.md name 一致
├── SKILL.md                     # Required · L1
├── pipeline.yaml                # Required · L2（文件名可配置，见 metadata）
├── references/                  # Optional
├── scripts/                     # Optional · 需审核后启用
└── assets/                      # Optional
```

---

## 2. L1：`SKILL.md`

### 2.1 必填 frontmatter

| 字段 | 约束 | AIMarket 备注 |
|------|------|---------------|
| `name` | 1–64，小写+数字+连字符，= 目录名 | 与 `pipeline.yaml` 的 `id` **建议一致** |
| `description` | 1–1024，含 **做什么 + 何时用** | 市场搜索与 Agent 选路主信号 |

### 2.2 推荐 metadata（`aimarket.io/*`）

| Key | 类型 | 说明 |
|-----|------|------|
| `aimarket.io/pipeline-file` | string | 默认 `pipeline.yaml` |
| `aimarket.io/pipeline-version` | string | 与 pipeline `version` 对齐 |
| `aimarket.io/category` | string | `ecommerce` / `drama` / `promo` / … |
| `aimarket.io/confirm-if-points-over` | string | 数字字符串，覆盖 pipeline 时可对账 |
| `aimarket.io/skill-kind` | string | `pipeline`（默认）\| `instruction-only` |
| `aimarket.io/author` | string | 市场作者 id 或 org |

规范允许未知 metadata key；宿主 **必须忽略** 不认识的 key。

### 2.3 Body 推荐章节

1. **概述** — 用户看到什么
2. **何时触发** — 关键词、反例（何时不要用）
3. **用户需准备** — 必填输入（商品图、梗概…）
4. **步骤概览** — 与 pipeline 步骤 id 对应的人类描述
5. **积分与确认** — `confirmIfPointsOver` 产品规则
6. **失败与重试** — 任一步失败时的行为

Body **不应**嵌入可执行 YAML steps（保持在 `pipeline.yaml`）。

---

## 3. L2：`pipeline.yaml`

与现有 `SkillDefinition` 完全一致：

```yaml
id: ecommerce-taobao-launch-v1
version: 1
name: 淘宝上架全套
description: 电商套图 4 张 + 主图抠白底 + 15 秒宣传片
confirmIfPointsOver: 80
steps:
  - id: gen_set
    type: generate_set
    label: 生成电商套图（4 张）
  # ...
```

### 3.1 步骤类型（当前）

| type | 用途 |
|------|------|
| `generate_set` | 电商套图 batch |
| `tool` | `STUDIO_TOOLS` |
| `video` | 宣传片 |
| `character_refs` / `scene_refs` | 短剧定稿 |
| `keyframe_batch` / `shot_video_batch` | 分镜→视频 |
| `tts_batch` / `lipsync_batch` | 对白 |
| `music_gen` | MV BGM |
| `concat` | 成片合成 |

新 step type 需：**schema 扩展 + executor 实现 + 文档**，不可仅在 `SKILL.md` 声明。

### 3.2 id 一致性

| 字段 | 规则 |
|------|------|
| `pipeline.yaml` → `id` | 必须 = `SKILL.md` → `name` |
| 市场 `slug` | 建议 = `name` |

---

## 4. `instruction-only` Skill（无 pipeline）

用于 **仅增强 Studio Agent 提示**、不触发长 Job 的包：

```yaml
metadata:
  aimarket.io/skill-kind: instruction-only
```

- 仅有 `SKILL.md`，无 `pipeline.yaml`
- Agent 激活时加载 body，不创建 `skill_runs`
- 适合社区分享的「电商文案规范」「分镜写作指南」等

---

## 5. Loader 契约（目标实现 S1）

```typescript
interface SkillPackage {
  /** Anthropic Tier-1 */
  name: string;
  description: string;
  frontmatter: Record<string, unknown>;
  instructionsMarkdown: string;
  /** AIMarket Tier-3；instruction-only 时为 undefined */
  pipeline?: SkillDefinition;
  rootDir: string;
}

function loadSkillPackage(skillId: string): SkillPackage;
function loadSkill(skillId: string): SkillDefinition; // 兼容：package.pipeline ?? legacy yaml
```

解析顺序：

1. `{skillsDir}/{skillId}/SKILL.md` + metadata 指向的 pipeline 文件
2. fallback `{skillsDir}/{skillId}.yaml`（legacy）

---

## 6. 校验命令（目标）

```bash
# 仅 pipeline（今日可用）
npx @aimarket/skill-schema validate pipeline.yaml

# 完整包（S1+）
npx @aimarket/skill-schema validate-package ./ecommerce-taobao-launch-v1
# → SKILL.md frontmatter + name/dir 一致 + pipeline Zod + metadata 对账
```

可选集成官方 [`skills-ref validate`](https://agentskills.io/specification#validation) 作 L1 校验。

---

## 7. 与 drama Plan Agents 的边界

| 概念 | 路径 | 规范 |
|------|------|------|
| Plan Agent（编剧/导演…） | `docs/agents/drama/` | 项目 manifest，**非** Agent Skills 包 |
| 制作 Skill（drama-short-v1） | `packages/agent-skills` | **本格式** L1+L2 |
| 魔术棒意图矩阵 | `docs/MAGIC_WAND_PROMPT_ENGINE.md` | 未来可拆为 instruction-only Skill |

Plan Agent 产出 `DramaProjectData` → 用户确认 → **加载 L2 pipeline** 执行制作。
