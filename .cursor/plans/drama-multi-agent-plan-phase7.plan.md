# AI 短剧 Phase 7：多 Agent Plan 模式 + 画布增量展示

> 前置：Phase 0–6 已完成（drama_projects/runs、skill 流水线、三栏 Studio、E2E、创作台入口修复）。
> 本文档覆盖 **7.1–7.3**；7.4 多轮 PATCH 重跑、7.5 一键成片留作后续。

## 目标

将当前 **单次 LLM `planDramaProject`** 升级为 **Cursor/Claude Code 式 Plan 模式**：

1. 调用**推理向大模型**（可展示 reasoning 摘要）
2. **五专职 Agent** 链式产出：编剧 → 导演 → 角色 → 摄影 → 分镜
3. 规划过程中在**无限画布时间线**增量展示进度与预览块
4. 规划完成后进入现有 `DramaStudioPanel` 确认 → `drama-short-v1` skill 制作

## 现状差距

| 模块 | 现状 | Phase 7 后 |
|------|------|-----------|
| `apps/api/src/lib/drama/planner.ts` | 单次 `completeWithFallback` + 大 JSON schema | `planner/` 目录五 Agent 链 |
| `POST /drama/runs` autoProduce=false | 同步返回完整 project | 可选 `planMode: "multi_agent"` + stream |
| `scroll-canvas` | 仅制作态 `orchestrationExtra` | 规划批次 + Agent 卡片 |
| `agent-core` LLM | 无 reasoning 通道 | `AGENT_DRAMA_PLAN_MODEL` + think/commit |

---

## Phase 7.1 — 五 Agent 链式规划（后端）

### 交付物

- [ ] `apps/api/src/lib/drama/planner/` 目录结构：
  ```
  planner/
    index.ts          # planDramaProjectMultiAgent() 入口，兼容旧 planDramaProject
    types.ts          # DramaPlanAgentId, AgentStepResult, PlanningContext
    agents/
      writer.ts       # 剧本 + 对白 + acts + narratorLines
      director.ts     # styleBible + 情绪/节奏备注
      character.ts    # characters[] Anchor First
      cinematographer.ts  # 每镜 cameraSpec / lighting / motion 意图
      storyboard.ts   # shots[] 8–15 镜
    merge.ts          # 合并五步产出为 dramaProjectSchema
    reasoning.ts      # 可选 think 阶段 prompt + 解析
  ```
- [ ] 环境变量（`deploy/.env.production.example` 同步）：
  - `AGENT_DRAMA_PLAN_ENABLED=true`
  - `AGENT_DRAMA_PLAN_MODEL`（如 `deepseek-reasoner` / `qwen-max`）
  - `AGENT_DRAMA_PLAN_FALLBACK_MODEL`（结构化 commit 失败时降级）
- [ ] `POST /drama/runs` body 增加 `planMode?: "single" | "multi_agent"`（默认 `multi_agent` 当 LLM 可用）
- [ ] `scripts/test-drama-agent.mjs`：断言五步合并后 shots 8–15、characters≥1、acts 非空

### Agent 契约（JSON schema 分拆）

| Agent | 输入上下文 | 输出字段 |
|-------|-----------|----------|
| writer | userIdea, targetDurationSec | title, logline, acts[], narratorLines[], shots[].dialogue（仅对白） |
| director | + writer | styleBible, productionNotes? |
| character | + writer, director | characters[] |
| cinematographer | + shots 骨架 | 每镜 cameraSpec, motionPrompt 修订 |
| storyboard | 全部上文 | shots[] 完整（visualPrompt, durationSec, continuity） |

链式规则：**后一步只 append/refine，不删除前步 id**；最终 `merge.ts` 走 `dramaProjectSchema.parse`。

### 推理模式（Think → Commit）

每个 Agent 可选两阶段（`DRAMA_PLAN_THINK_ENABLED`）：

1. **Think**：自由文本推理（展示用，长度上限 2k 字）
2. **Commit**：`jsonSchema` 严格输出

失败策略：Commit 失败 → 降级 `single` 旧 planner 或 `buildRuleBasedProject`。

### 非目标（7.1）

- 不做 SSE（留给 7.2）
- 不改画布 UI（留给 7.3）
- 不实现单 Agent 重跑（7.4）

---

## Phase 7.2 — 规划流式 API + 持久化

### 交付物

- [ ] DB：`drama_plan_runs` 表
  ```sql
  id, session_id, user_id, user_idea, status,
  current_agent, agents_json, reasoning_json,
  project_id NULL, error, created_at, updated_at
  ```
  - `agents_json`：`Record<AgentId, { status, reasoning?, output?, completedAt? }>`
- [ ] `POST /api/v1/drama/plan/runs` — 创建规划 run，异步执行五 Agent
- [ ] `GET /api/v1/drama/plan/runs/:id` — 轮询状态（MVP）；`GET .../events` SSE（可选同 PR）
- [ ] `GET /api/v1/drama/plan/runs/:id/stream` — SSE：`agent_start` | `agent_reasoning` | `agent_done` | `plan_complete` | `plan_failed`
- [ ] 规划完成：写入 `drama_projects`，`drama_plan_runs.project_id` 关联
- [ ] 前端 `use-drama-plan.ts`：subscribe SSE / poll，更新 `dramaDraftProject`

### SSE 事件形状

```typescript
type DramaPlanEvent =
  | { type: "agent_start"; agent: DramaPlanAgentId }
  | { type: "agent_reasoning"; agent: DramaPlanAgentId; chunk: string }
  | { type: "agent_done"; agent: DramaPlanAgentId; summary: string }
  | { type: "plan_complete"; projectId: string; estimatedPoints: number }
  | { type: "plan_failed"; error: string };
```

### 与现有 API 关系

- `POST /drama/runs` + `autoProduce: false` 内部改为：创建 `drama_plan_run` → 等待完成 → 返回 project（同步兼容）
- 新 UI 走 `POST /drama/plan/runs` + stream（异步体验）

### 测试

- [ ] integration：`plan run` 完成且 `agents_json` 五步均为 `done`
- [ ] 无 LLM 时：整链 fallback rule-based，事件仍按序发出

---

## Phase 7.3 — 无限画布规划时间线

### 交付物

- [ ] `DramaPlanTimeline` 组件：展示五 Agent 步骤条 + reasoning 折叠区
- [ ] `scroll-canvas`：规划进行中 `showTimeline=true`（`dramaPlanRun` 活跃即可，无需 canvas items）
- [ ] 每 `agent_done` 在时间线插入预览块：
  - writer → 场次/梗概卡片
  - director → 色板/光影标签
  - character → 角色名 + promptAnchor 摘要
  - cinematographer → 镜头术语摘要
  - storyboard → 缩略分镜列表（文字版，图在制作后）
- [ ] `studio-orchestration-provider`：规划态 `timelineEvent.runType = "drama_plan"`
- [ ] `DramaStudioPanel`：仅在 `plan_complete` 后显示三栏编辑；规划中显示「规划进行中…」
- [ ] E2E `drama-short.spec.ts` 扩展：mock plan stream，断言时间线出现「编剧」「分镜」等 Agent 标签

### UX 流程

```
用户输入梗概 → 开始短剧规划
  → 画布时间线：编剧 ✓ → 导演 ✓ → … → 分镜 ✓
  → 三栏分镜板出现 → 用户编辑/确认 → 开始制作（现有 skill）
```

### 非目标（7.3）

- 规划阶段不生成图片（图仍在 char_refs/keyframes 制作步）
- 不做 Agent 单步编辑重跑 UI（7.4）

---

## 实施顺序与 PR 策略

| PR | 分支 | 内容 |
|----|------|------|
| #191 | `feature/drama-plan-agents-v8` | 7.1 only |
| #192 | `feature/drama-plan-stream-v9` | 7.2 |
| #193 | `feature/drama-plan-canvas-v10` | 7.3 + E2E |

每 PR：`pnpm typecheck` + `test-drama-agent.mjs` + 相关 E2E。

---

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| 五连 LLM 延迟高 | Think 可关；Agent 并行化留 7.x+（character∥director） |
| reasoning 泄露隐私/过长 | 截断 + 仅登录会话可见 |
| 生产无 LLM | fallback rule-based + 仍发 SSE 事件 |
| schema 漂移 | 每 Agent 独立 zod schema + merge 单测 |

---

## 验收清单（7.1–7.3 完成）

- [ ] 创作台 AI 短剧：输入梗概后可见五 Agent 规划进度（非一次性空白等待）
- [ ] 规划完成：三栏分镜板、积分预估、确认制作
- [ ] CI：`drama-short` E2E 覆盖规划时间线
- [ ] 生产：配置 `AGENT_DRAMA_PLAN_MODEL` 后走推理链；未配置走 fallback

---

## 参考路径

- 规划入口：`apps/api/src/lib/drama/planner.ts`（将变薄，委托 `planner/index.ts`）
- Skill 流水线：`packages/agent-skills/skills/drama-short-v1.yaml`
- 画布挂载：`apps/web/src/components/scroll-canvas.tsx`、`studio-canvas-with-orchestration.tsx`
- 创作台提交：`apps/web/src/lib/creation-orchestration-submit.ts` → `submitDramaOrchestration`
