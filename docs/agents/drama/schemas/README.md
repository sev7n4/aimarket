# Schema 注册表 — Plan Agent 输出契约

> 实现：`apps/api/src/lib/drama/planner/schemas.ts`  
> 校验：LLM Commit 阶段 `jsonSchema` 参数（OpenAI-compatible structured output）

---

## 1. 设计原则

1. **additionalProperties: false** — 禁止模型臆造字段
2. **required 最小集** — 每 Agent 只约束本步产出
3. **跨 Agent 引用** — shot.id / character.id 由 writer 定义，下游 schema 只校验存在性不重复定义
4. **最终合法化** — `mergePlanningContext` → `dramaProjectSchema.parse`（`apps/api/src/lib/drama/schema.ts`）

---

## 2. Schema 索引

| Schema 常量 | Agent | 关键约束 |
|-------------|-------|----------|
| `WRITER_JSON_SCHEMA` | writer | shots 8–15；acts/scenes minItems 1 |
| `DIRECTOR_JSON_SCHEMA` | director | palette ≥2 色；aspectRatio enum |
| `CHARACTER_JSON_SCHEMA` | character | characters 1–4；visualSignature 六必填 |
| `CINEMATOGRAPHER_JSON_SCHEMA` | cinematographer | shots 8–15；每 id 含 cameraSpec |
| `STORYBOARD_JSON_SCHEMA` | storyboard | visualPrompt + durationSec 必填 |
| `QC_JSON_SCHEMA` | qc-director | narrative/composition 0–100（内联于 qc-director.ts） |

---

## 3. Writer → Storyboard 字段演进

```
writer.shots:     id, order, sceneId, characterIds, dialogue
       ↓
cinematographer:  id, cameraSpec, motionPrompt
       ↓
storyboard:       + visualPrompt, durationSec, useLastFrameContinuity
                  (可 refine motionPrompt/cameraSpec)
       ↓
merge:            + status: pending, 默认值填充
```

---

## 4. cameraSpec 结构

```typescript
{
  shotSize: string;    // 如「中景 MS」
  movement: string;    // 如「固定」「缓慢推近」
  lighting: string;
  colorTemp?: string;
}
```

---

## 5. character visualSignature

必填：`ageRange`, `faceShape`, `eyeShape`, `hairStyle`, `skinTone`, `signatureOutfit`  
可选：`distinguishingFeatures[]`

用于 Anchor First 三视图 prompt 与 Skill `char_refs` 步骤。

---

## 6. 与 manifest 同步

[manifest.yaml](../manifest.yaml) 中每个 agent 的 `outputs.schema` 指向此文件常量名。  
**D1 任务**：CI 脚本断言 manifest agent id 与 `schemas.ts` export 一一对应。

---

## 7. 变更流程

1. 改 `schemas.ts` + 对应 Agent systemPrompt（agents/*.ts 或未来 manifest）
2. 更新本 README + 单 Agent manifest
3. 跑 `scripts/test-drama-agent.mjs` / integration
4. 若影响 `dramaProjectSchema`，同步前端类型与 Studio 展示
