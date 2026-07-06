# 魔术棒提示词优化引擎设计（可持续迭代）

> 状态：**v1.0 本期闭环** · 最近更新：2026-07-06
> **本期 PR-1~4 + hotfix 已全部合并部署**（#284 ~ #288）。PR-5 及更大改动暂搁置，见 §11。
> 本文档持续迭代，每次变更在文末「变更记录」追加条目。

## 1. 背景与痛点（已解决项标注 ✅）

魔术棒（`Wand2`）是创作台输入框内的一键提示词润色入口。

**链路（当前）**：

```
creation-panel 点击魔术棒
  → resolveIntent（L1）+ readRecentAcceptedPrompts（L3）
  → POST /api/v1/prompt/optimize { context, mode }
  → optimizePromptAsync
      → buildOptimizeSystemPrompt（L2 意图矩阵 + few-shot）
      → provider 链（dashscope → openai/DeepSeek → 模板兜底）
  → 回填 prompt + polishHint（source · directionLabel）+ 可选「换一个」
```

初版痛点与本期对应关系：

| # | 原根因 | 本期状态 |
|---|--------|----------|
| R1 | LLM 系统人设固化（`BASE_SYSTEM` 三条通用句） | ✅ PR-1：`INTENT_PERSONA` 11 种意图专家矩阵 |
| R2 | 意图识别未接润色 | ✅ PR-2：`resolveIntent` → `context.intentSignal` |
| R3 | 零个性化 | ✅ PR-4：`recentAccepted` 本地画像 + few-shot |
| R4 | provider 未配置 → 模板兜底 | ✅ 生产已配 DeepSeek V4 Pro；失败仍模板兜底（#287） |

## 2. 目标与非目标

### 目标
- **场景精准**：不同意图（局部编辑 / 扩图 / 超清 / 抠图 / 改字 / 文生图 / 图生视频 / 电商主图 …）产出结构与侧重不同的专业提示词。
- **千人千面**：结合用户历史采纳、偏好风格、目标模型特性做个性化。
- **一键直出不牺牲**：默认仍是"点一下即回填"，不强制多轮问答。
- **可持续迭代**：意图矩阵、个性化画像、澄清问答均可独立演进。

### 非目标（本期）
- 不自动提交生成（保持 human-in-loop，仅回填输入框）。
- 不把图片/视频车道改成左对话双栏（那是 agent 编排形态，过度设计）。
- 不做重量级用户画像系统（起步用轻量 few-shot）。

## 3. 总体架构（四层）

```
魔术棒点击
   │
   ├─ L1 意图推理（前端复用 resolveIntent）
   │     └─ primarySignal + signals + confidence  ──┐
   │                                                │
   ├─ L3 个性化画像（最近采纳范例 / 风格 / 模型偏好）─┤
   │                                                ▼
   └────────────────────────►  POST /prompt/optimize
                                         │
                                L2 意图条件化系统提示词
                                （BASE_SYSTEM → 意图矩阵）
                                         │
                                provider 链（dashscope→openai→模板兜底）
                                         │
                                L4 结构化输出 { direction, prompt, variants? }
                                         │
                          回填输入框 + 气泡"已按【局部编辑】优化" + 备选切换
```

核心思想：**让"识别到的意图/场景/用户画像"去驱动 LLM 的系统提示词**，而不是加多轮对话。

## 4. 分层设计

### L1 意图推理（前端，复用已有能力）
- 魔术棒点击时调用 `resolveIntent(input)`（`intent-router.ts` 已有），拿到 `primarySignal / signals / confidence`。
- 无需新增算法；把结果塞进 `context`。
- confidence 用于 L4 是否触发澄清（见 4.5）。

### L2 意图条件化系统提示词（后端主改动）
将 `context.ts` 中扁平的 `BASE_SYSTEM` 升级为**按意图信号索引的专家模板矩阵** `INTENT_PERSONA`。

每个条目提供：
- **persona**：该场景的专家身份。
- **dimensions**：需覆盖的结构化维度（主体 / 场景 / 光影 / 材质 / 镜头 / 风格 …）。
- **negatives**：该场景常见负面提示。
- **constraints**：该场景硬约束（如"只改指定区域""保持透视连续"）。

初版意图矩阵（可迭代）：

| 意图信号 | persona 侧重 | 关键约束 |
|----------|--------------|----------|
| `image-generate` | 文生图专家 | 主体+场景+光影+材质+风格 完整铺陈 |
| `image-edit` | 局部编辑专家 | 只改指定区域，保持主体/光影/风格一致，描述改动前后差异 |
| `image-expand` | 扩图专家 | 延展环境，保持透视与光源方向连续，避免主体变形 |
| `image-enhance` | 超清增强专家 | 保持原构图与语义，仅强调清晰度/细节/质感，不改内容 |
| `image-cutout` | 抠图专家 | 明确主体边界、干净 alpha、发丝细节 |
| `image-erase` | 消除专家 | 明确待消除对象与背景补全策略 |
| `image-text` | 文字编辑专家 | 精确文字内容/字体/位置，其余不变 |
| `image-variation` | 变体专家 | 保留风格骨架，仅变化姿态/角度/配色 |
| `video-generate` | 文生视频专家 | 镜头运动、时长节奏、分镜、氛围 |
| `video-from-image` | 图生视频专家 | 首尾帧一致、镜头运动幅度、避免主体漂移 |
| `video-edit` | 视频编辑专家 | 明确编辑段落与目标效果 |
| `ecommerce`（mode） | 电商视觉专家 | 卖点、主图规范、干净背景/场景、商业摄影质感 |

组装顺序：`persona → dimensions → constraints → 上下文（模型/比例/参考图）→ 个性化 → 输出格式`。
> 保留现有 `modelHint / aspectHint / hasReferenceImages` 逻辑，作为矩阵之上的叠加修饰。

### L3 千人千面（个性化注入）
`context` 扩展轻量画像（按成本从低到高，分期上）：
1. **最近采纳范例（起步）**：用户最近 N 条被采纳的润色结果，作为 few-shot 示例注入系统提示词。
2. **风格关键词**：从历史 prompt 抽取高频风格词（如"电影感/日系/极简"）。
3. **模型偏好**：常用模型 → 复用 `modelHint`。
4. （后续）沉淀持久化 style profile。

起步只做 (1)，成本低、见效快。

### L4 结构化输出 + 人审
后端返回结构化结果（向后兼容：老字段 `prompt` 保留）：

```jsonc
{
  "prompt": "推荐提示词正文",          // 兼容旧字段
  "direction": "image-edit",           // 推断的意图方向（用于 UI 提示）
  "directionLabel": "局部编辑",         // 中文标签
  "variants": ["备选1", "备选2"],       // 可选
  "source": "dashscope"                // 兼容旧字段
}
```

前端：
- 回填 `prompt` 到输入框（保持现状）。
- 气泡提示"已按【局部编辑】优化"（`directionLabel`）。
- 若有 `variants`，提供"换一个"切换。
- **不自动提交**。

### 4.5 低置信澄清 — ⏸ 本期不做（PR-5 搁置）
- 仅当 L1 `confidence` 低于阈值（如 < 0.4）且输入稀疏时，弹**一个**澄清 chip 问题（如"是要整体重画，还是只改局部？"）。
- 回答后再走 L2–L4。默认高置信路径永远一键直出。

## 5. 接口契约

### 5.1 `PromptOptimizeContext` 扩展（`types.ts`）
```ts
export interface PromptOptimizeContext {
  modelId?: string;
  aspectRatio?: string;
  hasReferenceImages?: boolean;
  creationLane?: string;
  // 新增
  intentSignal?: string;        // primarySignal，如 "image-edit"
  intentConfidence?: number;    // 0-1
  recentAccepted?: string[];    // few-shot 范例（最多 3 条，各 <=200 字）
}
```
zod schema 同步扩展并加长度上限。

### 5.2 响应体（`prompt.ts` / `PromptOptimizeResult`）
```ts
export interface PromptOptimizeResult {
  prompt: string;
  source: PromptOptimizeSource;
  direction?: string;
  directionLabel?: string;
  variants?: string[];
}
```

### 5.3 兼容性
- 所有新字段可选；旧前端不传 = 退化为当前行为。
- 模板兜底路径也返回 `direction`（用 mode 映射），保证 UI 一致。

## 6. 分期落地（PR 拆分）— 本期交付状态

| PR | 范围 | GitHub | 状态 |
|----|------|--------|------|
| **PR-1** | 后端意图矩阵 + `direction/directionLabel` | [#284](https://github.com/sev7n4/aimarket/pull/284) | ✅ 已部署 |
| **PR-2** | 前端 `resolveIntent` 注入 + 方向标签 | [#285](https://github.com/sev7n4/aimarket/pull/285) | ✅ 已部署 |
| **PR-3** | 多候选 `variants` +「换一个」UI | [#286](https://github.com/sev7n4/aimarket/pull/286) | ✅ 已部署 |
| **hotfix** | DeepSeek `n=1` + LLM 失败回落模板 | [#287](https://github.com/sev7n4/aimarket/pull/287) | ✅ 已部署 |
| **PR-4** | 个性化 `recentAccepted` few-shot | [#288](https://github.com/sev7n4/aimarket/pull/288) | ✅ 已部署 |
| **PR-5** | 低置信澄清一问 | — | ⏸ 暂不做 |

> 合并 commit 线：`#284` → `#285` → `#286` → `#287` → `#288`（main 当前含全部能力）。

## 7. 测试策略（本期已覆盖项 ✅）
- **单测/集成** ✅：`scripts/test-prompt-optimize.ts`（15 项：意图矩阵、DeepSeek `n=1` cap、few-shot、模板兜底）。
- **回归** ✅：不传新字段时输出与旧版一致。
- **兜底** ✅：LLM 失败时模板路径仍返回 `direction`（#287）。
- **生产冒烟** ✅：2026-07-06 手动 11 场景复测通过（§11.2）；自动化脚本/workflow 见 backlog §11.4 #6。
- **E2E**：创作台魔术棒回填 + `directionLabel` 气泡（PR-2 后可用；未单独列为 gate）。

## 8. 埋点（后续迭代，本期未接入）
- 魔术棒点击率、`direction` 分布。
- 回填采纳率（润色后是否修改/清空）。
- `variants` 切换率。
- 回填后**生成成功/满意**对比未用魔术棒基线。
- 低置信澄清触发率与完成率（PR-5 后）。

## 9. 风险与权衡
- **延迟**：LLM 调用有耗时；保留 loading + 45s 超时 + 模板兜底。
- **成本**：few-shot 增加 token；限制范例条数与长度。
- **意图误判**：以 confidence 为闸，低置信不强改方向（沿用现有 mode）。
- **过度结构化**：`variants` 默认关闭或按需，避免拖慢主路径。

## 10. 涉及文件清单

| 层级 | 路径 | 职责 |
|------|------|------|
| 后端引擎 | `apps/api/src/lib/prompt-optimize/{types,context,index,openai,dashscope,template}.ts` | 意图矩阵、provider、兜底 |
| 后端路由 | `apps/api/src/routes/prompt.ts` | `POST /optimize` |
| 前端入口 | `apps/web/src/components/creation-panel.tsx` | 魔术棒、variants 切换、采纳记录 |
| 意图 | `apps/web/src/lib/intent-router.ts` | `resolveIntent` |
| 个性化 | `apps/web/src/lib/prompt-style-profile.ts` | 本地 `recentAccepted` 读写 |
| API 客户端 | `apps/web/src/lib/api-client.ts` | `optimizePromptApi` |
| 单测 | `scripts/test-prompt-optimize.ts` | 意图矩阵 / DeepSeek n=1 / few-shot |
| 生产复测 | `scripts/verify-prompt-optimize-prod.mjs` | 11 场景冒烟（**仅在** `enhancement/verify-prompt-optimize-prod` 分支，见 §11.2） |
| 文档 | 本文件 | 设计与迭代记录 |

---

## 11. 本期闭环总结

### 11.1 生产环境配置（`/opt/aimarket/.env`）

当前生产通过 **OpenAI 兼容接口** 接 DeepSeek V4 Pro：

```bash
PROMPT_OPTIMIZE_PROVIDER=openai
OPENAI_API_KEY=<DeepSeek API Key>
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_CHAT_MODEL=deepseek-v4-pro
PROMPT_OPTIMIZE_VARIANTS=1          # DeepSeek 仅支持 n=1；代码亦会 cap（#287）
DEEPSEEK_API_KEY=<同上>              # Agent 链路复用
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
AGENT_LLM_DEEPSEEK_MODEL=deepseek-v4-pro
```

修改 `.env` 后需重建 API 容器：

```bash
cd /opt/aimarket
export TCR_REGISTRY=ccr.ccs.tencentyun.com TCR_NAMESPACE=aimarket IMAGE_TAG=latest
docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.prod.images.yml up -d --force-recreate api
```

### 11.2 生产复测（2026-07-06，#287 后）

复测脚本位于分支 `enhancement/verify-prompt-optimize-prod`（尚未合入 main）。当时于生产 API 执行：

```bash
API_BASE=http://119.29.173.89:4100 node scripts/verify-prompt-optimize-prod.mjs
```

| 指标 | 结果 |
|------|------|
| 场景数 | 11 |
| 硬失败（500/网络） | **0** |
| 方向匹配 | **11/11** |
| LLM 润色成功 | **9~10/11**（偶发超时/空内容 → 模板兜底，不再 500） |
| 结论 | **复测通过 ✓** |

典型效果：局部编辑强调「仅改指定区域」；图生视频强调「首帧一致」；电商主图结构化卖点——与意图矩阵设计一致。

### 11.3 已知限制（接受或后续迭代）

| 项 | 说明 |
|----|------|
| DeepSeek 无多候选 | `n>1` 会 400；生产 `VARIANTS=1`，「换一个」仅在支持 `n>1` 的 provider 下有多条备选 |
| 部分场景模板兜底 | 扩图/消除等偶发 LLM 空内容或超时，#287 已回落模板而非 500 |
| 个性化仅本地 | `prompt-style-profile` 存 `localStorage`，换设备/清缓存丢失；未做服务端画像 |
| 采纳判定较粗 | 仅「提交内容与润色候选完全一致」记采纳；大幅手改不计入 |
| 输出语言 | DeepSeek 偶发中英混排；可后续在 persona 加强「输出中文」 |
| PR-5 未做 | 低置信澄清 chip 仍搁置 |

### 11.4 后续迭代 backlog（按需启动）

优先级建议：

1. **埋点闭环**：魔术棒点击率、`direction` 分布、采纳率、生成成功率对比（§8 清单）。
2. **provider 能力探测**：自动检测 endpoint 是否支持 `n>1`，避免配置踩坑。
3. **PR-5 低置信澄清**：`confidence < 0.4` 且输入过短 → 单次 chip 问答。
4. **服务端 style profile**：跨设备同步 `recentAccepted`。
5. **意图矩阵运营化**：`INTENT_PERSONA` 抽离为可热更新配置（类似 agent.md 矩阵）。
6. **生产复测 workflow 合入 main**：`.github/workflows/verify-prompt-optimize.yml`（目前在 `enhancement/verify-prompt-optimize-prod` 分支）。

### 11.5 用户侧使用说明（产品闭环）

1. 输入描述 → 点魔术棒（`Wand2`）。
2. 等待润色（气泡显示 `DeepSeek · 局部编辑` 等方向标签）。
3. 若有「换一个」图标，可在备选间切换（需 provider 返回 `variants`）。
4. 满意后**直接提交**；若未改润色结果即提交，系统记入个性化范例，下次润色更贴你的风格。
5. 可随时手改回填内容再提交（human-in-loop，不自动出图）。

---

## 附录 A：各 Phase 实现细则

### Phase 1（PR-1）后端意图条件化引擎 — ✅ 已交付 (#284)

### Phase 2（PR-2）前端接线 + 方向可视化 — ✅ 已交付 (#285)

### Phase 3（PR-3）结构化输出 + 备选切换 — ✅ 已交付 (#286)

### Phase 4（PR-4）个性化（千人千面）— ✅ 已交付 (#288)

- 采纳存储：`apps/web/src/lib/prompt-style-profile.ts`（`localStorage` key: `aimarket.prompt.recentAccepted`，最多 5 条）
- 采纳判定：`creation-panel` 提交时 `polishCandidates.includes(prompt.trim())` → `recordAcceptedPrompt`
- 注入：魔术棒调用 `readRecentAcceptedPrompts(3)` → `context.recentAccepted`

### Phase 1 实现要点（源码为准）

- 意图矩阵：`apps/api/src/lib/prompt-optimize/context.ts` 内 `INTENT_PERSONA`（11 种信号 + `ecommerce` mode 分支）。
- 回退映射：`image/chat → image-generate`；`ecommerce` 沿用电商 persona。
- 响应：`direction` / `directionLabel` 由 `intentSignal` 或 mode 推导；模板兜底亦返回方向标签。
- 验收：不传 `intentSignal` 行为与旧版一致；传 `image-edit` 时系统提示词含「仅」「指定区域」「保持一致」等约束词。

### Phase 2 实现要点

- `creation-panel.tsx`：魔术棒 handler 调 `resolveIntent`，注入 `intentSignal` / `intentConfidence`。
- `api-client.ts`：`optimizePromptApi` 透传 context，解析 `direction` / `directionLabel`。
- UI：`polishHint` 展示 `{source} · {directionLabel}`（如 `DeepSeek · 局部编辑`）。

### Phase 3 实现要点

- Provider：`openai.ts` / `dashscope.ts` 通过 chat `n` 取多候选；`resolveEffectiveCandidateCount` 对 DeepSeek cap 为 1（#287）。
- 前端：润色气泡旁「换一个」循环 `variants`；无备选时按钮隐藏。
- 配置：`PROMPT_OPTIMIZE_VARIANTS`（1–5，默认 3；生产 DeepSeek 建议 1）。

### Phase 4 实现要点

- 存储：`apps/web/src/lib/prompt-style-profile.ts`（`localStorage` key: `aimarket.prompt.recentAccepted`，最多 5 条）。
- 采纳：提交时 `polishCandidates.includes(prompt.trim())` → `recordAcceptedPrompt`。
- 注入：魔术棒调用 `readRecentAcceptedPrompts(3)` → `context.recentAccepted` → 后端 few-shot。

### Phase 5（PR-5）低置信澄清一问 — ⏸ 暂不做

- 触发条件（设计稿）：L1 `confidence < 0.4` 且输入过短 → 单次 chip 二选一。
- 高置信路径保持一键直出，不打断。
- 详见 §4.5、§11.4 backlog #3。

---

## 变更记录

- **v1.0（2026-07-06）**：**本期闭环**。PR-1~4 + hotfix（#284~#288）全部合并部署；新增 §11 闭环总结（生产配置、复测、已知限制、backlog、用户说明）；PR-5 明确搁置。附录 A 改为已交付实现要点，源码以 `context.ts` / `prompt-style-profile.ts` 为准。
- v0.5（2026-07-06）：PR-3（#286）已合并部署；PR-4 个性化开发中。
- v0.4（2026-07-06）：PR-2（#285）已合并部署；PR-3 结构化 variants 开发中。
- v0.3（2026-07-06）：PR-1（#284）已合并部署；PR-2 前端接线开发中。
- v0.2（2026-07-05）：追加附录 A 各 Phase 实现细则与 `INTENT_PERSONA` 草稿。
- v0.1（2026-07-05）：初稿。确立四层架构、意图矩阵、context/响应契约、PR 分期。
