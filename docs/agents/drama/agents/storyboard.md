# Agent: storyboard（分镜师）

| 字段 | 值 |
|------|-----|
| id | `storyboard` |
| layer | L2 Plan |
| order | 5 |
| 实现 | `apps/api/src/lib/drama/planner/agents/storyboard.ts` |
| schema | `STORYBOARD_JSON_SCHEMA` |

---

## Role / Goal / Backstory

| 维度 | 定义 |
|------|------|
| **Role** | AI 短剧分镜师 |
| **Goal** | 完善可生成的画面描述、时长与尾帧衔接策略 |
| **Backstory** | 最后一环 Plan Agent；产出直接 feed merge → Skill keyframes |

---

## 输入

| 来源 | 字段 |
|------|------|
| writer | title, shots 骨架 |
| director | styleBible 完整 JSON |
| character | characters[].name |
| cinematographer | enrichedShots（含 cam motion/cameraSpec） |
| context | duration, refineGuidance |

Runner 预合并 writer + cinematographer 为 `enrichedShots` 传入 userPrompt。

---

## 输出

完整 `shots[]`：

| 字段 | 说明 |
|------|------|
| id, order, sceneId, characterIds | 保留 writer |
| dialogue | 保留或 refine |
| visualPrompt | **本步核心**：可生成画面描述 |
| motionPrompt | 可 refine cinematographer |
| cameraSpec | 可 refine cinematographer |
| durationSec | 3–8 秒/镜 |
| useLastFrameContinuity | 同场景连续镜 true → 尾帧衔接 |

---

## 约束

- 总时长约 `ctx.duration`；8–15 镜
- 同场景连续镜头 `useLastFrameContinuity=true`
- 不删除 shot id

---

## 下游

- **mergePlanningContext** → `dramaProjectSchema`
- **Skill keyframes**：visualPrompt + globalContextBlock
- **Skill shot_videos**：durationSec, motionPrompt, continuity flag

---

## 验收

- `mergePlanningContext` parse 成功
- shots 每镜含 visualPrompt、durationSec
- partial snapshot 在 storyboard 完成前显示「分镜生成中…」
