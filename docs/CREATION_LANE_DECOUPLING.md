# 创作 Dock 三车道解耦计划

> 状态：Phase 4 进行中；Phase 0–3 已合并（#143–#145）  
> 关联问题：Studio 默认 Agent 车道 + 有参考图时走 Agent 提交，导致图生图不创建 `generation_jobs`  
> 最后更新：2026-06-05

## 背景

AIMarket 创作 Dock 提供三条「车道」：

| 车道 | 提交 API | 用途 |
|------|----------|------|
| **图片生成** | `POST /ai/generate` | 文生图、图生图（参考图 / `@` 引用） |
| **Agent** | `POST /agent/runs` | 多步编排、自动选模型 |
| **视频生成** | `POST /ai/generate/video` | 文生视频、图生视频 |

### 当前问题（未解耦）

| 维度 | 状态 |
|------|------|
| UI（`creation-dock-controls.tsx`） | 按 lane 切换控件，**浅解耦** |
| 提交 API | 三套 endpoint 已分离 |
| 状态 / 路由 / 存储 | **未解耦** — Agent 可抢占图片提交 |
| 视频 `videoReferenceMode` | 仅 UI 态，注释写「后续可接 API」 |

**图生图故障根因（已定位）**：

1. Studio 默认 `creationLane = "agent"`（`creation-panel.tsx` + `agentOrchestration`）
2. `studio-orchestration-provider.tsx` 的 `dispatchSubmit` 在 Agent 车道时走 `startAgentRun(prompt)`，**不传** `assetIds` / `referenceOutputIds`
3. `execute-step.ts` 创建 Agent job 时也无 `referenceUrls`
4. 三车道共用 `prompt`、`assetIds`、`selectedRefs`；`localStorage` 键 `aimarket.creationDock.lane` 首页与 Studio **共享**
5. 画布参考图需 `@` 引用才进入提交；仅选中画布 item 不会自动带入

**临时规避**：切到「图片生成」车道 + `@` 引用或 Dock 上传参考图。

### 目标架构

```
submitByLane(lane)
├── image  → /ai/generate（含 referenceUrls / assetIds）
├── agent  → /agent/runs（无参考图；有参考图时守卫回退 image）
└── video  → /ai/generate/video
```

- 分车道 draft 状态（`LaneDraft`）
- 拆分 storage：`aimarket.home.lane` / `aimarket.studio.lane`
- Studio 默认车道改为 `image`（Phase 2）

### 待拍板决策

| 决策 | 建议 |
|------|------|
| Studio 默认车道 | `agent` → **`image`**（Phase 2） |
| Agent 是否支持参考图 | 短期 **不支持**，引导切图片车道 |
| 有参考图时用户切到 Agent | **提示并自动切回图片车道**（Phase 0 守卫） |

---

## 分阶段计划

### Phase 0 — 提交路由守卫（P0）`fix/creation-lane-submit-guard`

**目标**：有参考图时禁止 Agent / Skill 提交；修复 `dispatchSubmit` 与 CreationPanel 路由不一致。

**任务**：

- [x] 新建 `apps/web/src/lib/creation-lane-submit.ts`（`hasReferenceImages`、`resolveSubmitPath` / 守卫函数）
- [x] `creation-panel.tsx`：`handleSubmit` 使用守卫；`referenceOutputIds: []` → `undefined`
- [x] `studio-orchestration-provider.tsx`：`dispatchSubmit` 有参考图时 `return false` 回落图片流
- [x] E2E：Studio 图片车道 + 参考图触发 `/ai/generate`

**验收**：带参考图在 Studio 默认态（或 Agent 车道）提交 → 走图片生成 API，DB 出现 `generation_jobs`。

---

### Phase 1 — 提交逻辑提取（P0/P1）`refactor/creation-lane-submit`

**任务**：

- [x] 扩展 `creation-lane-submit.ts`：`shouldUseAgentSubmit`、`shouldUseSkillSubmit`、`shouldUseStudioOrchestrationSubmit`
- [x] `CreationPanel` 瘦身，`handleSubmit` 仅调用守卫函数
- [x] Skill 归属 Agent 车道；去掉非 Dock 场景 Agent 泄漏（`isDock && creationLane !== "agent"` 时不走 Agent）
- [x] 有参考图切 Agent 时 toast + 自动切图片车道

**验收**：三车道提交路径单一来源；无参考图 Agent 行为不变。

---

### Phase 2 — 分车道状态与存储（P1）`refactor/creation-lane-state`

**任务**：

- [x] `LaneDraft` + `useCreationLaneDrafts`（原 `useCreationLaneState` 已移除，见 P6-0）
- [x] 拆分 `aimarket.home.lane` / `aimarket.studio.lane`（迁移旧 key）
- [x] Studio 默认 `creationLane` 改为 `image`
- [x] 更新 E2E：`creation-dock-ui.spec.ts` 中 Studio 默认期望由 Agent → 图片

**验收**：首页与 Studio 车道偏好互不影响；Studio 打开即为图片车道。

---

### Phase 3 — 视频参考与画布绑定（P1）`feat/video-reference-and-canvas-refs`

**任务**：

- [x] 视频 `videoReferenceMode` 接入 API
- [x] 画布选中 reference 自动绑定（无需强制 `@`）
- [x] 车道专属 UI 文案与空态提示

**验收**：视频提交携带 referenceMode + 参考图；点选画布即可图生图。

---

### Phase 4 — 后端溯源与灵感（P2）`feat/generation-source-lane`

**任务**：

- [x] `generation_jobs.source_lane` 字段
- [x] 时间线 / 历史按车道标记（批次 subtitle 展示车道名）
- [x] 灵感「做同款」按素材类型选车道（#145，图片 / 视频）

**验收**：生成 job 写入 source_lane；canvas-bundle 回传；时间线 subtitle 含车道文案。

---

## PR 顺序（建议）

```
fix/creation-lane-submit-guard     ← Phase 0
refactor/creation-lane-submit      ← Phase 1
refactor/creation-lane-state       ← Phase 2
feat/video-reference-and-canvas-refs ← Phase 3
feat/generation-source-lane        ← Phase 4
```

每 Phase 独立 PR，须通过：`lint-typecheck`、`docker-build`、`Integration Tests`、`E2E Tests`。

---

## 关键文件

```
apps/web/src/components/creation-panel.tsx
apps/web/src/components/studio-orchestration-provider.tsx
apps/web/src/components/creation-dock-controls.tsx
apps/web/src/lib/creation-dock-prefs.ts
apps/web/src/lib/creation-lane-submit.ts          ← Phase 0 新增
apps/web/src/lib/inspiration-studio.ts
apps/api/src/routes/ai.ts
apps/api/src/lib/agent/execute-step.ts
apps/api/src/lib/references.ts
apps/web/e2e/creation-dock-ui.spec.ts
```

---

## Phase 5 — 提交逻辑单源化（P1）

> 原则：共享 job 管线，隔离提交决策；不拆三套 worker / 三个 Panel。

| PR | 分支 | 范围 | 验收 |
|----|------|------|------|
| **5-1** | `refactor/creation-lane-submit-tests` | `buildDirectSubmitContext` / `resolveCreationSubmitPath`；`scripts/test-creation-lane-submit.ts`；接入 `pnpm test:integration` | 守卫矩阵单测全绿；`resolveSubmitPath` 无死代码 |
| **5-2** | `refactor/creation-panel-submit-path` | `CreationPanel.handleSubmit` 改为 `switch(resolveCreationSubmitPath)`；删除重复 `if/else` | E2E `creation-lane-submit.spec.ts` 仍绿；typecheck 通过 |
| **5-3** | `refactor/orchestration-submit-shared` | 抽出 `creation-orchestration-submit.ts`（Skill/Agent 确认与发起）；Studio Provider 与首页 Dock 共用 | 首页 Agent 车道与 Studio 行为一致；无重复 confirm/start 逻辑 |

**依赖**：5-1 → 5-2 → 5-3（可 squash 为 1 个 PR，建议分 2–3 个便于 review）。

---

## Phase 6 — 分车道 Draft 状态（P1）

| PR | 分支 | 范围 | 验收 |
|----|------|------|------|
| **6-1** | `refactor/creation-lane-draft-types` | 扩展 `LaneDraft`（modelId、aspectRatio、count、videoReferenceMode、videoDurationSec、outputPrefMode）；`aimarket.{scope}.laneDrafts` 存储 API | 类型与读写单测；旧 lane key 迁移不受影响 |
| **6-2** | `refactor/creation-lane-draft-hook` | `useCreationLaneDrafts(scope)`：切 lane 时 save/load；refs 在 image/video 间共享、agent 清空 | 单元测试覆盖 save/load 往返 |
| **6-3** | `feat/creation-panel-lane-drafts` | `CreationPanel` 接入 draft hook；`outputPrefMode` 按 scope+lane 存储 | E2E：图片车道配 16:9 → 切视频 → 切回图片，比例仍在 |
| **6-4** | `chore/creation-lane-doc-drift` | 修正 `videoReferenceMode` 注释；Skill `source_lane`（可选，或并入 Phase 7） | 文档与代码一致 |

**依赖**：6-1 → 6-2 → 6-3；6-4 可与 6-3 并行。

---

## Phase 7 — Skill 溯源与废弃 legacy execute（P2）

| PR | 分支 | 范围 | 验收 |
|----|------|------|------|
| **7-1** | `feat/phase7-skill-source-lane` | `skill-executor` 写入 `source_lane`；`inferSkillStepSourceLane` | `test-agent-skill.mjs` 断言 gen_set=agent、video=video |
| **7-2** | 同上 | `inspiration-set-generate-bar` 改用 `createSkillRun`；移除 `executeAgentPlan` | 无前端调用 `/agent/execute` |
| **7-3** | 同上 | `/agent/execute` 保留但加 `Deprecation` 头；文档更新 | 集成测试全绿 |

**依赖**：Phase 6 合并后启动。

**共享策略（拍板）**：

- **按 lane 隔离**：modelId、aspectRatio、count、videoReferenceMode、videoDurationSec、outputPrefMode
- **跨 lane 共享**：prompt、upload refs（image/video）；切 agent 时守卫清空或拒绝
- **不拆**：`createGenerationJob` 管线、画布、session、计费

---

## 进度日志

| 日期 | Phase | 说明 |
|------|-------|------|
| 2026-06-05 | 0–1 | 提交路由守卫、`creation-lane-submit.ts`、E2E `creation-lane-submit.spec.ts`（#143） |
| 2026-06-07 | 2 | 分 scope lane 存储、`useCreationLaneState`、Studio 默认图片车道（#144） |
| 2026-06-07 | 3 | 视频 referenceMode API、画布自动参考绑定、车道占位文案（#145） |
| 2026-06-07 | 4 | `generation_jobs.source_lane`、时间线车道标记、灵感做同款按类型选车道 |
| 2026-06-07 | 5 | PR #147 合并并部署；提交路由单源化完成 |
| 2026-06-07 | 6 | PR #148：LaneSettingsDraft + useCreationLaneDrafts，按车道保留模型/比例 |
| 2026-06-07 | 7 | 分支 `feat/phase7-skill-source-lane`：Skill source_lane + 废弃 `/agent/execute` 前端调用 |
