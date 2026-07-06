# Agent: character（角色设计师）

| 字段 | 值 |
|------|-----|
| id | `character` |
| layer | L2 Plan |
| order | 3 |
| 实现 | `apps/api/src/lib/drama/planner/agents/character.ts` |
| schema | `CHARACTER_JSON_SCHEMA` |

---

## Role / Goal / Backstory

| 维度 | 定义 |
|------|------|
| **Role** | AI 短剧角色设计师（**Anchor First**） |
| **Goal** | 为剧本角色产出可生成三视图的视觉定稿 + 配音选型 |
| **Backstory** | 角色 id 与分镜引用严格对齐；visualSignature 支撑 Skill `char_refs` |

---

## 输入

| 来源 | 字段 |
|------|------|
| writer | title, logline, shots[].characterIds |
| director | styleBible.lightingStyle, palette |
| catalog | `DRAMA_VOICE_CATALOG` → voiceId 选项列表 |
| refine | refineGuidance |

userPrompt 显式列出分镜引用的 char id 并集。

---

## 输出

| 字段 | 说明 |
|------|------|
| `characters[].id` | **必须**与 writer 分镜 characterIds 一致 |
| `name` | 角色名 |
| `role?` | 角色定位 |
| `personalityTone` | 性格语气 |
| `visualSignature` | 六必填 + distinguishingFeatures |
| `promptAnchor` | 三视图/定稿板 prompt |
| `voiceId` | 来自 voice catalog |
| `voiceStyle?` | 展示名 |

---

## 约束

| 规则 | 值 |
|------|-----|
| 角色数量 | 1–4（schema maxItems: 4） |
| id 对齐 | 不得删除 writer 已引用 id |
| 新增角色 | refine 场景可分配新 char_* id |

---

## 与制作 Skill 衔接

规划完成后 Skill 第一步 `char_refs`（`drama-short-v1.yaml`）：

- 读取 `characters[].promptAnchor` + visualSignature
- 生成三视图 Anchor；audit characterMinScore / styleMinScore

---

## 下游消费者

- **storyboard**：角色名列表 enrich userPrompt
- **merge**：`project.characters`
- **tts / lipsync**：voiceId
