# 创作 Dock 三车道解耦计划

> 状态：Phase 0–1 已完成（待 PR）；Phase 2 待开始  
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

- [ ] `LaneDraft` + `useCreationLaneState`
- [ ] 拆分 `aimarket.home.lane` / `aimarket.studio.lane`（迁移旧 key）
- [ ] Studio 默认 `creationLane` 改为 `image`
- [ ] 更新 E2E：`creation-dock-ui.spec.ts` 中 Studio 默认期望由 Agent → 图片

**验收**：首页与 Studio 车道偏好互不影响；Studio 打开即为图片车道。

---

### Phase 3 — 视频参考与画布绑定（P1）`feat/video-reference-and-canvas-refs`

**任务**：

- [ ] 视频 `videoReferenceMode` 接入 API
- [ ] 画布选中 reference 自动绑定（无需强制 `@`）
- [ ] 车道专属 UI 文案与空态提示

---

### Phase 4 — 后端溯源与灵感（P2）`feat/generation-source-lane`

**任务**：

- [ ] `generation_jobs.source_lane` 字段
- [ ] 时间线 / 历史按车道标记
- [ ] 灵感「做同款」默认图片车道

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

## 进度日志

| 日期 | Phase | 说明 |
|------|-------|------|
| 2026-06-05 | 0–1 | 提交路由守卫、`creation-lane-submit.ts`、E2E `creation-lane-submit.spec.ts` |
