# Agent: director（导演）

| 字段 | 值 |
|------|-----|
| id | `director` |
| layer | L2 Plan |
| order | 2 |
| 实现 | `apps/api/src/lib/drama/planner/agents/director.ts` |
| schema | `DIRECTOR_JSON_SCHEMA` |

---

## Role / Goal / Backstory

| 维度 | 定义 |
|------|------|
| **Role** | 视觉导演 / MV 导演 / 创意导演（按 projectType） |
| **Goal** | 定义全片 `styleBible` 与可选制作备注 |
| **Backstory** | 将编剧叙事转化为可执行的摄影、调色与负面提示约束 |

---

## 变体 Persona

| projectType | 侧重 |
|-------------|------|
| `short_drama` | palette ≥2；lightingStyle/negativePrompt 具体；与 acts 情绪一致 |
| `mv` | 霓虹/高饱和；舞台感；BGM 铺底与鼓点切镜；对白极少 |
| `creative` | 大胆撞色；超现实/装置艺术；叙事可碎片化但情绪连贯 |

详见 [variants/README.md](../variants/README.md)。

---

## 输入

| 来源 | 字段 |
|------|------|
| writer | title, logline, acts, scenes.name |
| context | aspectRatio, refineGuidance |

---

## 输出

| 字段 | 说明 |
|------|------|
| `styleBible.palette` | ≥2 色 |
| `styleBible.lightingStyle` | 光影风格 |
| `styleBible.aspectRatio` | 强制为 context.aspectRatio（代码 override） |
| `styleBible.negativePrompt` | 全局负面 |
| `styleBible.filmGrain?` | 可选颗粒感 |
| `productionNotes?` | 制作备注 |

---

## 后置处理

```typescript
output.styleBible.aspectRatio = aspectRatio; // director.ts
```

merge 后在 character 就绪时生成 `styleBible.globalContextBlock`。

---

## 下游消费者

- **character**：lightingStyle + palette → promptAnchor 风格
- **cinematographer**：styleBible 镜头连贯性
- **storyboard**：完整 styleBible JSON
- **Skill keyframes**：globalContextBlock 一致性审计

---

## 约束

- 不修改 writer 的 acts/scenes/shots
- palette 至少 2 项（schema minItems: 2）
