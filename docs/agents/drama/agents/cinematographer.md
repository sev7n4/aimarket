# Agent: cinematographer（摄影指导）

| 字段 | 值 |
|------|-----|
| id | `cinematographer` |
| layer | L2 Plan |
| order | 4 |
| 实现 | `apps/api/src/lib/drama/planner/agents/cinematographer.ts` |
| schema | `CINEMATOGRAPHER_JSON_SCHEMA` |

---

## Role / Goal / Backstory

| 维度 | 定义 |
|------|------|
| **Role** | AI 短剧摄影指导 |
| **Goal** | 为每个分镜 id 定义镜头规格与运动描述 |
| **Backstory** | 同场景镜头运动连贯；遵循 director styleBible |

---

## 输入

| 来源 | 字段 |
|------|------|
| director | styleBible.lightingStyle, palette |
| writer | shots 骨架摘要（id, sceneId, chars, dialogue 数量） |
| refine | refineGuidance |

---

## 输出

每 shot **仅 patch**（不增删 id）：

| 字段 | 说明 |
|------|------|
| `id` | 与 writer 一致 |
| `cameraSpec.shotSize` | 景别 |
| `cameraSpec.movement` | 运镜 |
| `cameraSpec.lighting` | 光影 |
| `cameraSpec.colorTemp?` | 色温 |
| `motionPrompt` | 运动/动态描述（供 i2v） |

---

## 硬约束

```
noAddRemoveShotIds: true
```

schema shots min/max 与 writer 同为 8–15；id 集合必须等于 writer.shots。

---

## 下游消费者

- **storyboard**：`camById` 合并 motionPrompt / cameraSpec；可 refine
- **merge**：fallback 默认「中景 MS / 固定 / director.lightingStyle」
- **Skill shot_videos**：motionPrompt + cameraSpec → i2v

---

## 与 character 的顺序说明

规划链中 **cinematographer 在 character 之后调度**，但 runner **不读取** character output——仅 writer + director。  
角色视觉定稿不影响镜头语言步；storyboard 步才合并 character 名称。
