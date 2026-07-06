# L1 Orchestrator — 短剧规划编排器

> 实现：`apps/api/src/lib/drama/planner/index.ts`  
> 注册表：[manifest.yaml](./manifest.yaml)

---

## 1. 职责

Orchestrator **不包含创作判断**，只负责：

1. 按固定顺序调度五 Plan Agent
2. 维护共享 `PlanningContext`（累积各步 output）
3. 发射 SSE 事件（start / reasoning / done / snapshot）
4. 调用 `merge.ts` 产出 `DramaProjectData` 或中途 partial 快照
5. 支持从指定 Agent **重跑下游**（保留上游 output 与稳定 id）

---

## 2. 状态：PlanningContext

```typescript
interface PlanningContext {
  input: PlanDramaInput;       // userIdea, projectType, refineInstruction, ...
  duration: number;            // 默认 short_drama 90s, mv 60s
  aspectRatio: "9:16" | "16:9";
  writer?: WriterOutput;
  director?: DirectorOutput;
  character?: CharacterOutput;
  cinematographer?: CinematographerOutput;
  storyboard?: StoryboardOutput;
  refineInstruction?: string;  // 与 input 同源
  basePlan?: DramaProjectData; // 多轮迭代基准
}
```

与 LangGraph **State** 类比：`PlanningContext` 是 reducer 式累积状态，每 Agent 只写入自己的 slot。

---

## 3. 调度顺序

```
AGENT_STEPS = [writer, director, character, cinematographer, storyboard]
```

| 步骤 | 前置依赖 | 写入 ctx 字段 |
|------|----------|---------------|
| writer | input | `ctx.writer` |
| director | writer | `ctx.director` |
| character | writer + director | `ctx.character` |
| cinematographer | writer + director | `ctx.cinematographer` |
| storyboard | 全部上游 | `ctx.storyboard` |

**注意**：cinematographer 不依赖 character output（仅依赖 writer 分镜骨架 + director 风格），与制作阶段 Anchor First 顺序不同——角色视觉在规划链中先于摄影定稿 voice/三视图，摄影只处理镜头语言。

---

## 4. 单步执行协议

每个 Agent 步封装为 `runAgentStep`（orchestrator 层，非 reasoning 层）：

```
emit agent_start
  → runner(ctx)           // agents/*.ts
  → apply(ctx, output)    // 写入 PlanningContext
  → emit agent_reasoning? // 若 Think 阶段有摘要
  → emit agent_done       // summary 由 summarizeAgent 生成
  → mergePartialPlanningContext → emit agent_snapshot?
```

### summarizeAgent 规则

| Agent | summary 示例 |
|-------|--------------|
| writer | `{title} · {n} 镜 · {m} 幕` |
| director | `{lightingStyle} · {palette}` |
| character | 角色名逗号分隔 |
| cinematographer | `{n} 镜摄影方案` |
| storyboard | `{n} 镜分镜完成` |

---

## 5. 合并（Merge）

| 函数 | 时机 | 行为 |
|------|------|------|
| `mergePartialPlanningContext` | 每 Agent 完成后 | 按已有字段拼 partial project；未完成镜位显示「生成中…」 |
| `mergePlanningContext` | storyboard 完成后 | 严格合并 + `dramaProjectSchema.parse` |

合并规则要点：

- `storyboard.shots` 为最终 shots 主表；dialogue 回退到 writer 骨架
- `cameraSpec` / `motionPrompt` 优先 storyboard → cinematographer → 默认值
- `styleBible.globalContextBlock` 在 director + character 就绪后由 `buildGlobalContextBlock` 生成

---

## 6. 从 Agent 重跑

`planDramaProjectFromAgentWithEvents(ctx, fromAgent, emit)`：

1. `clearDownstreamContext`：删除 `fromAgent` 及下游 slot
2. 从 `fromAgent` 起顺序重跑 `AGENT_STEPS.slice(startIdx)`
3. 上游 writer/director/... 保留 → **id 稳定性**

典型场景：用户 PATCH 项目后仅重跑 `storyboard`，或 refine 后从 `writer` 重来。

---

## 7. 多轮迭代

当 `refineInstruction` + `basePlan` 同时存在时，各 Agent 的 userPrompt 追加 `refine.ts` 生成的 `refineGuidance` 块（`apps/api/src/lib/drama/planner/refine.ts`）：

- 要求**在既有方案上改写**，非从零生成
- 保留 `char_*` / `scene_*` / `shot_*`
- 附带 basePlan 精简 JSON 概览

Orchestrator 不负责解析 refine 语义，只透传 context。

---

## 8. 失败与 Fallback

Orchestrator 本身**不 catch LLM 错误**；失败向上抛给 `plan-executor.ts` / `planner.ts`：

```
multi_agent 失败 → single LLM planner
single 失败      → buildRuleBasedProject（规则引擎）
无 LLM Key       → 直接规则引擎
```

规则 fallback 仍按序 emit 五 Agent 事件（summary 含「规则引擎」），保证 UI 时间线一致。

---

## 9. 入口函数

| 函数 | 用途 |
|------|------|
| `planDramaProjectMultiAgentWithEvents(input, emit?)` | 全链 + 可选 SSE |
| `planDramaProjectMultiAgent(input)` | 全链同步 |
| `planDramaProjectFromAgentWithEvents(ctx, fromAgent, emit?)` | 部分重跑 |

上层调用：`plan-executor.ts` → `POST /drama/plan/runs` SSE 流。

---

## 10. 与业界模式对照

| 模式 | 短剧 Orchestrator 对应 |
|------|------------------------|
| LangGraph `StateGraph` | 手写顺序链 + `PlanningContext` |
| CrewAI sequential process | 固定五 Agent 流水线 |
| Anthropic subagent handoff | 每步 JSON Commit + schema 校验 |
| ReAct | 无 tool loop；单步 Think→Commit 可选 |

后续 D2 可将 `AGENT_STEPS` 声明移入 `manifest.yaml`，由 loader 生成调度表。
