# 墨鱼π 制片工作台 — PRD（Phase A–D）

> 功能 ID 前缀：`PROD-{Phase}{序号}`。  
> 愿景：[PRODUCTION_STUDIO_VISION.md](./PRODUCTION_STUDIO_VISION.md) · 排期：[PRODUCTION_STUDIO_DEV_PLAN.md](./PRODUCTION_STUDIO_DEV_PLAN.md)

---

## 0. 全局约定

### 0.1 路由

| 路径 | 说明 |
|------|------|
| `/` | 首页（制片 Hero + 灵感画廊） |
| `/studio?sessionId=&mode=production` | 制片 Studio |
| `/studio?sessionId=&mode=ecommerce` | 商业轨（保留） |
| `/inspiration` | 灵感/模板画廊 |
| `/projects` | 项目列表 |

### 0.2 已有 Drama API（基线，Phase A 复用）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/drama/runs` | 同步规划（`planMode: single \| multi_agent`） |
| POST | `/api/v1/drama/projects/:id/produce` | 确认后开始制作 |
| GET/PATCH | `/api/v1/drama/projects/:id` | 读/改项目 JSON |
| GET | `/api/v1/drama/runs/:id` | 制作 Run 状态 |
| POST | `/api/v1/drama/runs/:id/confirm` | 确认积分后开始 |
| POST | `/api/v1/drama/runs/:id/cancel` | 取消 |
| POST | `/api/v1/drama/runs/:id/retry` | 整片重试 |
| POST | `/api/v1/drama/runs/:id/shots/:shotId/retry` | 单镜重试 |
| POST | `/api/v1/drama/runs/:id/shots/:shotId/pick-keyframe` | 关键帧选优 |
| GET/POST | `/api/v1/drama/estimate` | 积分预估 |
| POST | `/api/v1/drama/plan/runs` | 异步多 Agent 规划 |
| GET | `/api/v1/drama/plan/runs/:id` | 规划 Run |
| GET | `/api/v1/drama/plan/runs/:id/stream` | 规划 SSE |
| POST | `/api/v1/drama/plan/runs/:id/rerun` | 从某 Agent 重跑 |
| GET | `/api/v1/drama/sessions/:sessionId/state` | 会话制片态恢复 |

### 0.3 核心前端文件索引

| 文件 | 职责 |
|------|------|
| `apps/web/src/components/studio-workspace.tsx` | Studio 主壳、会话、Dock |
| `apps/web/src/components/studio-orchestration-provider.tsx` | 制片/Agent 编排状态机 |
| `apps/web/src/components/studio-canvas-with-orchestration.tsx` | 画布 + Drama 面板桥接 |
| `apps/web/src/components/drama-studio-panel.tsx` | 制片侧栏主面板 |
| `apps/web/src/components/drama-plan-timeline.tsx` | 规划 Agent 时间线 |
| `apps/web/src/components/drama-storyboard-grid.tsx` | 分镜网格 |
| `apps/web/src/components/studio-dock.tsx` | 底部输入 Dock |
| `apps/web/src/hooks/use-drama-run.ts` | 制作 Run hook |
| `apps/web/src/hooks/use-drama-plan.ts` | 规划 Run + SSE hook |
| `apps/web/src/lib/api-client.ts` | Drama API 客户端 |
| `apps/api/src/routes/drama.ts` | Drama 路由 |
| `apps/api/src/lib/drama/planner/*` | 五 Agent 规划 |
| `apps/api/src/lib/drama/executor.ts` | 制作调度 |
| `apps/api/src/lib/drama/plan-executor.ts` | 规划调度 |
| `packages/agent-skills/skills/drama-short-v1.yaml` | 制作 Skill 定义 |

---

## Phase A — 追平 LibTV 主路径（0–3 月）

### PROD-A01 — 首页制片 Hero 入口

**描述**：首页主 CTA 从「开始创作」升级为「开始制片」，副 CTA 保留电商/画布。

**页面线框**：

```
┌─────────────────────────────────────────────────────────────┐
│  [墨鱼 Logo]  灵感画廊  定价  登录                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│     🦑  Agent 制片，画布交付                                 │
│     短剧 · 创意片 · 商业片                                   │
│                                                             │
│     [ 开始制片 ]    [ 电商套图 ]    [ 自由画布 ]              │
│                                                             │
│     灵感画廊瀑布流 ...                                       │
└─────────────────────────────────────────────────────────────┘
```

**API**：无新增（跳转 `POST /api/v1/sessions` 或现有 `ensureSession`）。

**代码映射**：

| 动作 | 文件 |
|------|------|
| Hero CTA | `apps/web/src/app/page.tsx` 或首页组件 |
| 品牌文案 | `apps/web/src/components/brand-slogan-heading.tsx` |
| 路由 | `apps/web/src/lib/studio-url.ts`（新建或扩展） |
| 埋点 | `apps/web/src/lib/analytics.ts` → `production_entry_click` |

**验收**：点击「开始制片」进入 `/studio?mode=production` 并创建新 session。

---

### PROD-A02 — Studio `production` 模式壳

**描述**：`mode=production` 时 Dock 默认制片意图；侧栏显示 Drama 面板而非纯对话。

**页面线框**：

```
┌──────────┬────────────────────────────────────┬──────────────┐
│ 会话列表 │         分镜/画布主区               │ Drama 面板   │
│          │  (scroll-canvas / storyboard)      │ · 大纲       │
│          │                                    │ · 角色       │
│          │                                    │ · 分镜列表   │
├──────────┴────────────────────────────────────┴──────────────┤
│ Studio Dock: 「描述你的短剧创意…」  [时长] [画幅] [开始规划]   │
└──────────────────────────────────────────────────────────────┘
```

**API**：`GET /api/v1/drama/sessions/:sessionId/state`

**代码映射**：

| 动作 | 文件 |
|------|------|
| mode 分支 | `apps/web/src/components/studio-workspace.tsx` |
| Dock 文案 | `apps/web/src/components/studio-dock.tsx`, `studio-creation-dock.tsx` |
| 默认 kind | `apps/web/src/lib/session-kind.ts` |
| 恢复态 | `studio-orchestration-provider.tsx` → `fetchDramaSessionState` |

**验收**：刷新页面后恢复进行中的 plan/run 状态。

---

### PROD-A03 — 多 Agent 规划提交

**描述**：Dock 提交走 `POST /drama/plan/runs`，支持 `autoProduce` 开关。

**API**：

| 方法 | 路径 | 请求体要点 |
|------|------|-----------|
| POST | `/api/v1/drama/plan/runs` | `sessionId, userIdea, targetDurationSec, aspectRatio, autoProduce` |

**代码映射**：

| 动作 | 文件 |
|------|------|
| 提交 | `studio-orchestration-provider.tsx` → `submitDramaOrchestration` |
| API | `apps/web/src/lib/api-client.ts` → `createDramaPlanRun` |
| 后端 | `apps/api/src/routes/drama.ts` L344–361 |
| 调度 | `apps/api/src/lib/drama/plan-executor.ts` |

**验收**：提交后返回 `planRunId`，状态 `planning`。

---

### PROD-A04 — 规划 Agent 时间线（SSE）

**描述**：规划进行中展示 writer → director → character → cinematographer → storyboard 五步进度；支持从某步重跑。

**页面线框**：

```
规划进度
● writer ──● director ──○ character ──○ cinematographer ──○ storyboard
           [重跑从此步]

事件流：
  10:01 writer 完成 — 剧本《…》
  10:02 director 进行中…
```

**API**：

| 方法 | 路径 |
|------|------|
| GET | `/api/v1/drama/plan/runs/:id/stream` (SSE) |
| POST | `/api/v1/drama/plan/runs/:id/rerun` |
| GET | `/api/v1/drama/plan/runs/:id` |

**代码映射**：

| 动作 | 文件 |
|------|------|
| SSE UI | `apps/web/src/components/drama-plan-timeline.tsx` |
| Hook | `apps/web/src/hooks/use-drama-plan.ts` |
| Provider | `studio-orchestration-provider.tsx` → `rerunDramaPlan` |
| 事件 | `apps/api/src/lib/drama/plan-events.ts` |
| Agent | `apps/api/src/lib/drama/planner/writer.ts` 等 |

**验收**：SSE 断线重连可 replay buffer；失败步可 rerun。

---

### PROD-A05 — 分镜时间线画布 v1

**描述**：画布主区由「滚动画布」切换为横向 **镜头轨**；每格显示缩略图、时长、对白摘要。

**页面线框**：

```
┌────┬────┬────┬────┬────┐
│ S1 │ S2 │ S3 │ S4 │ +  │  ← 横向滚动镜头轨
│3.2s│4.0s│3.5s│5.0s│    │
└────┴────┴────┴────┴────┘
选中 S2 ▼
  场景: 咖啡厅 | 角色: 小美
  对白: 「你怎么来了？」
  画面: [visualPrompt 编辑框]
  运镜: MS / 推轨
```

**API**：

| 方法 | 路径 | 说明 |
|------|------|------|
| PATCH | `/api/v1/drama/projects/:id` | `{ project: { shots: [...] } }` |

**代码映射**：

| 动作 | 文件 |
|------|------|
| 新组件 | `apps/web/src/components/drama-shot-timeline.tsx`（新建） |
| 挂载 | `studio-canvas-with-orchestration.tsx` |
| 网格备选 | `drama-storyboard-grid.tsx`（保留网格视图切换） |
| 合并 PATCH | `apps/api/src/lib/drama/merge-patch.ts` |
| Schema | `apps/api/src/lib/drama/schema.ts` |

**验收**：拖拽排序后 PATCH 成功；`estimate` 积分随镜头数更新。

---

### PROD-A06 — 分镜编辑与排序

**描述**：支持增删镜头、改 durationSec、对白、visualPrompt；防抖保存。

**API**：同 PROD-A05 + `POST /api/v1/drama/estimate`（body: project）

**代码映射**：

| 动作 | 文件 |
|------|------|
| 草稿态 | `use-drama-run.ts` → `saveDraftProject` |
| 预估 UI | `drama-studio-panel.tsx` |
| 预估 API | `apps/api/src/routes/drama.ts` L327–334 |

**验收**：编辑后 500ms 防抖保存；离开页面前未保存提示。

---

### PROD-A07 — 角色卡列表

**描述**：Drama 面板「角色」Tab 展示角色卡（名、性格、视觉签名、promptAnchor）。

**页面线框**：

```
角色 (2)
┌─────────────┐  ┌─────────────┐
│ 小美        │  │ 阿强        │
│ 开朗/短发   │  │ 内敛/眼镜   │
│ [编辑]      │  │ [编辑]      │
└─────────────┘  └─────────────┘
```

**API**：`PATCH /api/v1/drama/projects/:id` → `project.characters`

**代码映射**：

| 动作 | 文件 |
|------|------|
| UI | `drama-studio-panel.tsx`（角色区） |
| 规划产出 | `apps/api/src/lib/drama/planner/character.ts` |
| Schema | `schema.ts` → `characters` |

---

### PROD-A08 — 角色三视图定稿

**描述**：规划后为每个角色生成正面/侧面/背面参考图；用户标记「定稿」后制作锁定。

**页面线框**：

```
角色: 小美                    [已定稿 ✓]
┌────────┐ ┌────────┐ ┌────────┐
│ 正面   │ │ 侧面   │ │ 背面   │
│ [图]   │ │ [图]   │ │ [图]   │
└────────┘ └────────┘ └────────┘
[重新生成三视图]  [确认定稿]
```

**API（新增）**：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/drama/projects/:id/characters/:charId/turnaround` | 触发三视图生成 job |
| PATCH | `/api/v1/drama/projects/:id` | `characters[].turnaroundStatus: draft \| locked` |

**代码映射**：

| 动作 | 文件 |
|------|------|
| 新路由 | `apps/api/src/routes/drama.ts`（扩展） |
| 生成 | `apps/api/src/lib/drama/character-turnaround.ts`（新建） |
| UI | `apps/web/src/components/drama-character-card.tsx`（新建） |
| Job | `apps/api/src/routes/ai.ts` 或 skill-executor |

**验收**：未定稿角色阻止 `produce`；定稿后制作使用锁定 reference。

---

### PROD-A09 — 制作进度时间线

**描述**：制作中展示 pipeline 步骤（keyframe → video → stitch）及每镜状态。

**页面线框**：

```
制作中 · 预计 12 分钟
[████████░░░░] 67%

镜头轨（状态色）:
 S1✓  S2✓  S3…  S4○  S5○

当前: S3 生成视频中
```

**API**：

| 方法 | 路径 |
|------|------|
| GET | `/api/v1/drama/runs/:id`（轮询或 SSE 扩展） |
| GET | `/api/v1/ai/jobs/:jobId/stream`（单 job） |

**代码映射**：

| 动作 | 文件 |
|------|------|
| Run hook | `use-drama-run.ts` |
| 执行器 | `apps/api/src/lib/drama/executor.ts` |
| Skill | `drama-short-v1.yaml` |
| UI | `drama-studio-panel.tsx` 制作区 |

**验收**：单镜失败显示错误 +「重试此镜」按钮。

---

### PROD-A10 — 关键帧选优与单镜重试

**描述**：每镜多候选关键帧；用户选 hero；支持 keyframe/video 分阶段重试。

**API（已有）**：

| 方法 | 路径 |
|------|------|
| POST | `/api/v1/drama/runs/:id/shots/:shotId/pick-keyframe` |
| POST | `/api/v1/drama/runs/:id/shots/:shotId/retry` |

**代码映射**：

| 动作 | 文件 |
|------|------|
| 画布交互 | `studio-canvas-with-orchestration.tsx` L49–67 |
| API 客户端 | `api-client.ts` → `retryDramaShot`, `pickDramaKeyframe` |
| 后端 | `executor.ts` → `retryDramaShot`, `pickDramaKeyframeHero` |

**验收**：选优后制作继续使用 hero 帧。

---

### PROD-A11 — 成片导出与灵感发布

**描述**：MP4 完成后画布展示播放器；一键发布到灵感画廊。

**API**：

| 方法 | 路径 |
|------|------|
| POST | `/api/v1/inspiration/publish` |
| GET | `/api/v1/inspiration/mine` |

**代码映射**：

| 动作 | 文件 |
|------|------|
| 发布 | `apps/api/src/routes/inspiration.ts` |
| 画布播放器 | `design-canvas.tsx` 或 output 组件 |
| 发布按钮 | `drama-studio-panel.tsx` |
| 客户端 | `api-client.ts` → `publishInspiration` |

**验收**：发布后在 `/inspiration` 可见；可 DELETE 归档自己的条目。

---

### PROD-A12 — 制片 E2E 与生产冒烟

**描述**：Playwright 覆盖 production 模式完整路径；`scripts/smoke-api.mjs` 扩展 drama plan。

**代码映射**：

| 动作 | 文件 |
|------|------|
| E2E | `apps/web/e2e/drama-production.spec.ts`（新建） |
| 冒烟 | `scripts/smoke-api.mjs` |
| 会话切换 | `apps/web/e2e/studio-session-switch.spec.ts` |

**验收**：CI E2E 绿；生产脚本可 plan-only 冒烟。

---

## Phase B — 节点流与模板（3–6 月）

### PROD-B01 — 节点 DAG 只读视图

**描述**：将 `drama-short-v1` steps 映射为 React Flow 节点图；展示依赖关系。

**页面线框**：

```
[剧本] → [分镜] → [关键帧×N] → [视频×N] → [配音] → [合成]
   ✓        ✓         ●            ○          ○        ○
```

**API（新增）**：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/drama/runs/:id/graph` | 返回 DAG 节点 + 边 + 状态 |

**代码映射**：

| 动作 | 文件 |
|------|------|
| Skill 解析 | `apps/api/src/lib/agent/skill-executor.ts` |
| YAML | `packages/agent-skills/skills/drama-short-v1.yaml` |
| UI | `apps/web/src/components/drama-node-graph.tsx`（新建） |
| 图数据 | `apps/api/src/lib/drama/run-graph.ts`（新建） |

---

### PROD-B02 — 节点状态 SSE

**描述**：制作进度通过 SSE 推送节点级 `skill-runs` 状态，替代纯轮询。

**API（新增）**：

| 方法 | 路径 |
|------|------|
| GET | `/api/v1/drama/runs/:id/stream` |

**代码映射**：

| 动作 | 文件 |
|------|------|
| 路由 | `apps/api/src/routes/drama.ts` |
| 事件 | `apps/api/src/lib/drama/run-events.ts`（新建，仿 plan-events） |
| 前端 | `use-drama-run.ts` 订阅 SSE |

---

### PROD-B03 — 节点参数编辑与局部重跑

**描述**：点击节点编辑参数（如 motionPrompt）；从该节点重跑后续。

**API（新增）**：

| 方法 | 路径 |
|------|------|
| POST | `/api/v1/drama/runs/:id/nodes/:nodeId/rerun` |

**代码映射**：

| 动作 | 文件 |
|------|------|
| 执行 | `executor.ts` + `skill-executor.ts` |
| UI | `drama-node-graph.tsx` 节点抽屉 |

---

### PROD-B04 — 爆款复刻 Skill

**描述**：输入参考视频 URL，提取结构后生成新片规划。

**API（新增）**：

| 方法 | 路径 |
|------|------|
| POST | `/api/v1/drama/replicate/analyze` |
| POST | `/api/v1/drama/plan/runs` | `userIdea` + `replicateProfile` |

**代码映射**：

| 动作 | 文件 |
|------|------|
| Skill | `packages/agent-skills/skills/drama-replicate-v1.yaml`（新建） |
| 分析 | `apps/api/src/lib/drama/replicate.ts`（新建） |
| UI | `studio-dock.tsx` 复刻模式 Tab |

---

### PROD-B05 — MV / 创意片 Skill 壳

**描述**：60s 内单线叙事 + BGM 轨；复用 drama 引擎，不同 planner 模板。

**API**：扩展 `plan/runs` body → `projectType: short_drama | mv | creative`

**代码映射**：

| 动作 | 文件 |
|------|------|
| Planner | `apps/api/src/lib/drama/planner/director.ts` 分支 |
| Skill | `drama-mv-v1.yaml`（新建） |
| Schema | `schema.ts` → `projectType` |

---

### PROD-B06 — 模板 Copy（灵感 → 制片）

**描述**：灵感详情页「用此模板制片」复制 metadata 到新 session。

**API（新增）**：

| 方法 | 路径 |
|------|------|
| POST | `/api/v1/inspiration/:id/copy-to-session` |

**代码映射**：

| 动作 | 文件 |
|------|------|
| 灵感 | `apps/api/src/routes/inspiration.ts` |
| 前端 | `apps/web/src/app/inspiration/[id]/page.tsx` |
| 模板元数据 | `apps/api/src/lib/inspiration.ts` |

---

## Phase C — 超越 LibTV（6–12 月）

### PROD-C01 — OpenAPI 鉴权与 Session

**描述**：API Key 鉴权；外部创建/读写 Session。

**API（新增）**：

| 方法 | 路径 |
|------|------|
| POST | `/api/v1/open/sessions` |
| GET | `/api/v1/open/sessions/:id` |

**代码映射**：

| 动作 | 文件 |
|------|------|
| 路由 | `apps/api/src/routes/open.ts`（新建） |
| 中间件 | `apps/api/src/middleware/api-key.ts`（新建） |
| 文档 | `docs/spec/MOYU_SKILLS_OPENAPI.md`（新建） |

---

### PROD-C02 — 外部 Plan/Produce + Webhook

**API（新增）**：

| 方法 | 路径 |
|------|------|
| POST | `/api/v1/open/drama/plan` |
| POST | `/api/v1/open/drama/produce` |
| POST | `/api/v1/open/webhooks` |

**代码映射**：复用 `drama.ts` 逻辑 + open 路由薄封装。

---

### PROD-C03 — 导演质检 Agent

**描述**：制作完成后自动评分（构图、一致性、叙事）；写入 `run.qcReport`。

**API（新增）**：

| 方法 | 路径 |
|------|------|
| POST | `/api/v1/drama/runs/:id/qc` |
| GET | `/api/v1/drama/runs/:id/qc` |

**代码映射**：

| 动作 | 文件 |
|------|------|
| Agent | `apps/api/src/lib/drama/planner/qc-director.ts`（新建） |
| 触发 | `executor.ts` 完成后钩子 |

---

### PROD-C04 — 质检驱动自动重拍

**描述**：`qcScore < threshold` 自动 `retry` 低分镜头（可配置）。

**API**：扩展 `retry` + `project.productionParams.autoQcRetry`

**代码映射**：`executor.ts`, `drama-studio-panel.tsx` 设置项。

---

### PROD-C05 — 时间轴多轨剪辑 v1

**描述**：视频轨 + 配音轨 + BGM 轨；片段裁剪与排序。

**页面线框**：

```
时间轴 0:00 ─────────────────────────────── 1:30
视频  [====S1====][=====S2=====][===S3===]
配音  [~~对白1~~]   [~~对白2~~]
BGM   [───────────音乐───────────────]
```

**API（新增）**：

| 方法 | 路径 |
|------|------|
| PATCH | `/api/v1/drama/projects/:id/timeline` |
| POST | `/api/v1/drama/runs/:id/render` |

**代码映射**：

| 动作 | 文件 |
|------|------|
| UI | `apps/web/src/components/drama-timeline-editor.tsx`（新建） |
| 合成 | `apps/api/src/lib/drama/stitch.ts`（扩展） |

---

### PROD-C06 — Workspace 审片评论

**描述**：Workspace 成员在分镜/成片上留言；@制片人。

**API（新增）**：

| 方法 | 路径 |
|------|------|
| GET/POST | `/api/v1/workspaces/:id/reviews` |
| POST | `/api/v1/workspaces/:id/reviews/:reviewId/comments` |

**代码映射**：

| 动作 | 文件 |
|------|------|
| 路由 | `apps/api/src/routes/workspace.ts`（扩展） |
| UI | `studio-workspace.tsx` 协作侧栏 |

---

### PROD-C07 — 版本对比与回滚

**API（新增）**：

| 方法 | 路径 |
|------|------|
| GET | `/api/v1/drama/projects/:id/versions` |
| POST | `/api/v1/drama/projects/:id/restore/:versionId` |

**代码映射**：`apps/api/src/lib/drama/projects.ts` 版本表迁移。

---

### PROD-C08 — moyu-skills SDK 与示例

**描述**：npm 包 `@moyupi/skills` + OpenClaw 示例仓库。

**代码映射**：`packages/moyu-skills-sdk/`（新建 monorepo 包）。

---

## Phase D — 生态与商业（12–18 月）

### PROD-D01 — 商业片 Skill（30–60s）

**描述**：商品图 + 卖点文案 → 多镜头商业宣传片。

**API**：`POST /api/v1/commerce/video/plan`（新建 commerce 路由）

**代码映射**：

| 动作 | 文件 |
|------|------|
| 路由 | `apps/api/src/routes/productSet.ts`（扩展） |
| Skill | `commerce-video-v1.yaml` |
| UI | `creation-panel.tsx` mode=ecommerce 升级 |

---

### PROD-D02 — 商品镜头与主图联动

**描述**：电商套图产出图一键加入商业片镜头轨。

**代码映射**：`productSet.ts`, `studio-workspace.tsx` 资产桥接。

---

### PROD-D03 — Skill / 模板市场

**描述**：创作者上架 Skill；平台审核与分成。

**API**：`GET/POST /api/v1/marketplace/skills`

**代码映射**：新模块 `apps/api/src/routes/marketplace.ts`。

---

### PROD-D04 — 企业 Workspace + SSO

**API**：SAML/OIDC 集成 `apps/api/src/routes/auth.ts`

---

### PROD-D05 — 多区域与专属模型路由

**代码映射**：`apps/api/src/lib/providers/`, 部署 `docs/DEPLOY_CI.md`

---

## 附录 A — Phase A 功能 × 文件速查表

| 功能 ID | 主要改动文件 |
|---------|-------------|
| A01 | `page.tsx`, `brand-slogan-heading.tsx` |
| A02 | `studio-workspace.tsx`, `studio-orchestration-provider.tsx` |
| A03 | `studio-orchestration-provider.tsx`, `api-client.ts`, `drama.ts` |
| A04 | `drama-plan-timeline.tsx`, `use-drama-plan.ts`, `plan-executor.ts` |
| A05 | `drama-shot-timeline.tsx`(新), `studio-canvas-with-orchestration.tsx` |
| A06 | `use-drama-run.ts`, `drama-studio-panel.tsx`, `merge-patch.ts` |
| A07 | `drama-studio-panel.tsx`, `planner/character.ts` |
| A08 | `character-turnaround.ts`(新), `drama.ts`, `drama-character-card.tsx`(新) |
| A09 | `use-drama-run.ts`, `executor.ts`, `drama-short-v1.yaml` |
| A10 | `studio-canvas-with-orchestration.tsx`, `executor.ts` |
| A11 | `inspiration.ts`, `drama-studio-panel.tsx` |
| A12 | `e2e/drama-production.spec.ts`(新), `smoke-api.mjs` |

---

## 附录 B — 数据模型要点（Drama Project）

```typescript
// apps/api/src/lib/drama/schema.ts（现有，Phase A 扩展字段）
DramaProject {
  userIdea, targetDurationSec, aspectRatio
  script, styleBible, characters[], scenes[], shots[]
  productionParams: { previewTier, aspectRatio, autoQcRetry? }
  // Phase A 新增建议:
  characters[].turnaround?: { front, side, back, status }
  shots[].timelineOrder?: number
}
```

---

## 附录 C — Sprint A-S1 建议任务拆分（可直接开卡）

| 任务 | 负责人 | 文件 | 估点 |
|------|--------|------|------|
| 首页 CTA + 路由 | FE | `page.tsx`, `studio-url.ts` | 2 |
| `mode=production` 默认 Dock | FE | `studio-workspace.tsx`, `studio-dock.tsx` | 3 |
| 恢复 session state | FE | `studio-orchestration-provider.tsx` | 2 |
| 埋点 | FE | `analytics.ts` | 1 |
| E2E 冒烟入口 | FE | `e2e/` | 2 |

**合计**：~10 点（2 周 Sprint）
