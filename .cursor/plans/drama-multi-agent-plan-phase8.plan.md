# AI 短剧 Phase 8：生产可用 + 成片闭环 + 体验抛光

> 前置：Phase 7（7.1–7.5）已合并 main（#191–#194）。生产 E2E 复测（user001@163.com）结论：**规划链路可跑，制作链路在 char_refs 因 Agnes 500 失败**。
> 本文档为 Phase 8 正式规划；**8.1 已在 `feature/drama-prod-char-refs-fix` 着手实现**。

## 目标

从「能演示规划」升级为「用户能走完规划 → 确认 → 成片」：

1. 制作流水线在生产环境稳定（图像/视频 Provider 回落）
2. 生产启用真实 LLM 多 Agent 规划（非全程规则引擎）
3. 积分门控、失败态、入口发现等体验抛光

---

## 生产 E2E 复测摘要（2026-06-17）

| 环节 | 结果 |
|------|------|
| API 规划 | ✅ ~2s 完成，10 镜 |
| 五 Agent | ⚠️ 全部「规则引擎」，无 LLM |
| UI 规划时间线 + Studio | ✅ |
| char_refs 制作 | ❌ Agnes Image 500，无回落 |
| autoProduce | ❌ 项目最终 `failed` |
| 账户积分 253 vs 预估 576 | ⚠️ 未前置拦截 |

---

## Phase 8.1 — char_refs Provider 回落（P0）`feature/drama-prod-char-refs-fix`

### 根因

- 短剧 pipeline 默认 `productionParams.imageModelId = "agnes-image"`
- `agnes-image` 属于 `USER_SELECTED_IMAGE_MODEL_IDS`，**不走** Agnes → 万相 → Seedream 跨 Provider 回落
- Agnes 生产 500 时 job 直接 failed

### 交付物

- [x] `apps/api/src/lib/drama/image-job.ts`：`resolveDramaImageModelId` + `dramaImageGenerationJobParams`
- [x] `executor.ts`：`char_refs` / `scene_refs` / `keyframes` 使用 `omni-v2` + `routingMode: auto`
- [x] 新项目默认 `imageModelId: "omni-v2"`（merge / planner / schema）
- [x] 存量项目 `agnes-image` 在 executor 层映射为 auto 链
- [x] `scripts/test-drama-image-routing.ts`

### 验收

- [ ] 生产：`user001` 手动「确认分镜，开始制作」char_refs 在 Agnes 500 时回落万相/Seedream
- [ ] Integration：`pnpm exec tsx scripts/test-drama-image-routing.ts`

---

## Phase 8.2 — 生产 LLM 规划启用（P0）

### 交付物

- [ ] 生产 `.env` 配置 `AGENT_DRAMA_PLAN_MODEL` + Key
- [ ] `deploy/.env.production.example` 文档化必填项
- [ ] UI：Agent 摘要区分 LLM / 规则引擎 fallback（badge 或 tooltip）
- [ ] 可选：`DRAMA_PLAN_THINK_ENABLED` 开启推理折叠

### 验收

- [ ] 生产 plan run Agent summary **不含**「规则引擎」
- [ ] `scripts/test-drama-plan.mjs` 在生产 LLM 可用时断言非 rule-based

---

## Phase 8.3 — 积分门控与 autoProduce 保护（P1）

### 交付物

- [ ] 规划完成 / 确认制作前：积分 < `estimatedPoints` 时阻断并引导充值
- [ ] `autoProduce`：不足积分时不 dispatch，plan 仍 completed + 明确 error/hint
- [ ] `waiting_confirm`（≥200 分）在 Studio 与创作台一致展示

### 验收

- [ ] 253 积分账户对 576 分项目无法静默进入 producing

---

## Phase 8.4 — 制作态 UX 与失败恢复（P1）

### 交付物

- [ ] `DramaStudioPanel`：producing 态展示 pipeline 步骤 + 当前 job
- [ ] failed 态：错误摘要 +「重试制作 / 从某步重试」
- [ ] autoProduce 失败时 `setDramaRun` + 面板 error（非仅 alert）
- [ ] 制作进度 SSE 或 poll 接入画布时间线（可选）

---

## Phase 8.5 — 创作台发现性（P1）

### 交付物

- [ ] Studio Dock 紧凑模式**默认展示**「创意设计 / AI 短剧」入口（或短剧技能 badge）
- [ ] Agent 车道首次选短剧：轻量 coach（3 步：写梗概 → 看规划 → 确认制作）
- [ ] 首页 Agent 车道与 Studio 行为对齐

---

## Phase 8.6 — PATCH 深合并与 rerun 契约（P1）

### 交付物

- [ ] `projectPatch` 使用 deep merge（尤其 `script` / `shots`）
- [ ] `POST .../rerun` 同步重置 status=`planning` 后再返回（或 202 + poll）
- [ ] rerun 后保留用户未重跑 Agent 的上游字段

### 测试

- [ ] 扩展 `scripts/test-drama-plan-rerun.mjs`：PATCH title 生效

---

## Phase 8.7 — 会话恢复（P2）

### 交付物

- [ ] 刷新 Studio session：恢复 `dramaDraftProject` / 活跃 `dramaRun` / 最近 plan run
- [ ] 画布历史条目可跳转至短剧 Studio 态

---

## Phase 8.8 — 生产全链路验收（P0 收尾）

### 交付物

- [ ] `scripts/test-drama-prod-e2e.mjs`：登录 → 规划 → 制作 → poll 至 completed 或 waiting_confirm
- [ ] 文档：`docs/DRAMA_PROD.md` 生产检查清单

### 验收

- [ ] user001 或专用测试账号拿到 `finalVideoUrl`（低清 preview 档亦可）

---

## 实施顺序与 PR 策略

| PR | 分支 | 内容 |
|----|------|------|
| #195 | `feature/drama-prod-char-refs-fix` | 8.1 only |
| #196 | `feature/drama-prod-llm-plan` | 8.2 |
| #197 | `feature/drama-credits-gate` | 8.3 |
| #198 | `feature/drama-produce-ux` | 8.4 + 8.5 |
| #199 | `feature/drama-plan-patch-rerun` | 8.6 |

每 PR：`pnpm typecheck` + 相关 script + E2E smoke。

---

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| 万相/Seedream 生产 Key 未配 | deploy 检查 + preflight 告警 |
| 回落仍失败 | executor 单步重试 + 用户可见错误 |
| LLM 规划延迟 | 保留 rule-based fallback + SSE |
| 积分预估与实扣偏差 | 8.3 门控 + 制作完成后 reconcile |

---

## 参考路径

- 图像回落：`apps/api/src/lib/image-routing.ts`、`apps/api/src/providers/registry.ts`
- 短剧图像 job：`apps/api/src/lib/drama/image-job.ts`、`executor.ts`
- 规划：`apps/api/src/lib/drama/planner/`、`plan-executor.ts`
- 前端 Studio：`drama-studio-panel.tsx`、`studio-orchestration-provider.tsx`
- 生产 env：`deploy/.env.production.example`
