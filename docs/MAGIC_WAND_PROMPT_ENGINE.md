# 魔术棒提示词优化引擎设计（可持续迭代）

> 状态：Draft v0.3 · 负责人：TBD · 最近更新：2026-07-06
> 进度：PR-1 后端引擎已合并（#284）；PR-2 前端接线开发中。
> 本文档持续迭代，每次迭代在文末「变更记录」追加条目。

## 1. 背景与痛点

魔术棒（`Wand2`）是创作台输入框内的一键提示词润色入口。当前实现：

- 前端 `creation-panel.tsx` 点击魔术棒 → `optimizePromptApi(raw, mode, { context })`
  → 后端 `POST /api/v1/prompt/optimize` → `optimizePromptAsync`
  → provider 链 `dashscope → openai`，失败/未配置回落本地模板。
- **实际已接 LLM**，模板（`prompt-polish.ts` / `template.ts`）只是兜底。

尽管接了 LLM，用户仍感到"润色固化、千篇一律、做不到千人千面/场景精准"。**根因不是"没用 LLM"，而是：**

| # | 根因 | 证据 |
|---|------|------|
| R1 | LLM 的系统人设固化 | `context.ts` 的 `BASE_SYSTEM` 只有 `chat/image/ecommerce` 三条通用句子，一句话打天下 |
| R2 | 已有的强意图识别没接进润色 | `intent-router.ts` 能识别 15 种细粒度意图 + confidence，但只用于**提交路由**，润色链路零使用 |
| R3 | 零个性化 | 传给后端的 `context` 仅 `modelId/aspectRatio/hasReferenceImages/creationLane`，无用户历史/偏好/参考图内容 |
| R4 | provider 未配置时体感更死 | 线上若无 `DASHSCOPE_API_KEY/OPENAI_API_KEY`，一路回落模板 |

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

### 4.5 低置信澄清（可选，最后做）
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

## 6. 分期落地（PR 拆分）

| PR | 范围 | 价值 | 依赖 |
|----|------|------|------|
| **PR-1** | 后端引擎：`context` 加 `intentSignal`，`BASE_SYSTEM` → `INTENT_PERSONA` 意图矩阵，`buildOptimizeSystemPrompt` 条件化 + 集成测试 | 直击"固化"，最高优先，零 UI 改动 | 无 |
| **PR-2** | 前端接线：魔术棒调 `resolveIntent` 注入意图 + 展示 `directionLabel` | 场景可见、可解释 | PR-1 |
| **PR-3** | 结构化输出 + `variants` 切换 UI | 多方案、可控 | PR-1/2 |
| **PR-4** | 个性化：注入 `recentAccepted` 范例 | 千人千面 | PR-1 |
| **PR-5**（可选） | 低置信澄清一问 | 兜底体验 | PR-2 |

> 每个 PR 遵循仓库规则：功能分支 → `pnpm typecheck` + `pnpm test:integration` → PR → CI 全绿 → Squash & Merge。

## 7. 测试策略
- **单测/集成**：`buildOptimizeSystemPrompt` 针对每个意图信号断言关键约束词出现（如 `image-edit` 含"仅""指定区域"）。
- **回归**：不传新字段时输出与当前一致。
- **兜底**：LLM 失败时模板路径仍返回 `direction`。
- **E2E（PR-2 后）**：点击魔术棒后输入框被回填 + 出现 `directionLabel` 气泡。

## 8. 埋点（验证价值）
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
- 后端：`apps/api/src/lib/prompt-optimize/{types.ts,context.ts,index.ts,openai.ts,dashscope.ts,template.ts}`、`apps/api/src/routes/prompt.ts`
- 前端：`apps/web/src/components/creation-panel.tsx`、`apps/web/src/lib/{intent-router.ts,api-client.ts,prompt-polish.ts}`
- 文档：本文件

---

## 附录 A：各 Phase 实现细则

### Phase 1（PR-1）后端意图条件化引擎 ★最高优先

**目标**：不动 UI，仅凭意图矩阵让每种场景产出结构不同的专业提示词。

**改动点**
1. `types.ts`：`PromptOptimizeContext` 增加 `intentSignal?`、`intentConfidence?`；`PromptOptimizeResult` 增加 `direction?`、`directionLabel?`。zod schema 同步加长度/范围校验。
2. `context.ts`：新增 `INTENT_PERSONA` 矩阵与 `resolveIntentPersona(mode, context)`；`buildOptimizeSystemPrompt` 优先按 `intentSignal` 选 persona，回退到 `mode`。
3. `index.ts`：`optimizePromptAsync` 结果附带 `direction/directionLabel`（由 `intentSignal` 或 `mode` 推导），模板兜底路径同样返回。
4. 集成测试：覆盖每个意图信号的关键约束词。

**`INTENT_PERSONA` 草稿**（`context.ts`，可迭代）
```ts
interface IntentPersona {
  label: string;        // 中文方向标签
  persona: string;      // 专家身份
  dimensions: string[]; // 需覆盖维度
  constraints: string[];// 硬约束
  negatives?: string;   // 负面提示
}

const INTENT_PERSONA: Record<string, IntentPersona> = {
  "image-generate": {
    label: "文生图",
    persona: "你是资深文生图提示词专家。",
    dimensions: ["主体", "场景/背景", "光影", "材质/质感", "构图/视角", "风格"],
    constraints: ["保留用户原意", "补全缺失维度但不臆造关键主体"],
  },
  "image-edit": {
    label: "局部编辑",
    persona: "你是图像局部编辑提示词专家。",
    dimensions: ["编辑目标区域", "改动前后差异", "需保持不变的部分"],
    constraints: ["仅修改用户指定区域", "保持主体、光影、风格一致", "不要整体重画"],
    negatives: "避免改变未提及的区域、避免主体走形",
  },
  "image-expand": {
    label: "扩图",
    persona: "你是扩图（outpaint）提示词专家。",
    dimensions: ["向外延展的环境内容", "透视延续", "光源方向延续"],
    constraints: ["保持与原图透视/光影连续", "主体不变形", "接缝自然"],
  },
  "image-enhance": {
    label: "超清增强",
    persona: "你是画质增强提示词专家。",
    dimensions: ["清晰度", "细节", "质感"],
    constraints: ["保持原构图与语义", "只提升画质不改内容"],
  },
  "image-cutout": {
    label: "抠图",
    persona: "你是抠图提示词专家。",
    dimensions: ["主体边界", "alpha 干净度", "发丝/边缘细节"],
    constraints: ["精确主体边界", "背景干净透明"],
  },
  "image-erase": {
    label: "消除",
    persona: "你是物体消除提示词专家。",
    dimensions: ["待消除对象", "背景补全策略"],
    constraints: ["彻底移除目标", "背景无痕补全"],
  },
  "image-text": {
    label: "文字编辑",
    persona: "你是图像文字编辑提示词专家。",
    dimensions: ["目标文字内容", "字体/风格", "位置"],
    constraints: ["精确文字内容", "其余画面不变"],
  },
  "image-variation": {
    label: "变体",
    persona: "你是图像变体提示词专家。",
    dimensions: ["保留的风格骨架", "变化维度(姿态/角度/配色)"],
    constraints: ["保留原风格调性", "仅做可控变化"],
  },
  "video-generate": {
    label: "文生视频",
    persona: "你是文生视频提示词专家。",
    dimensions: ["主体动作", "镜头运动", "时长/节奏", "氛围"],
    constraints: ["描述可执行的镜头语言", "动作连贯"],
  },
  "video-from-image": {
    label: "图生视频",
    persona: "你是图生视频提示词专家。",
    dimensions: ["镜头运动幅度", "首尾帧一致性", "运动主体"],
    constraints: ["保持首帧主体一致", "避免主体漂移", "运动自然"],
  },
  "video-edit": {
    label: "视频编辑",
    persona: "你是视频编辑提示词专家。",
    dimensions: ["编辑段落", "目标效果"],
    constraints: ["明确编辑范围", "风格连续"],
  },
};
```
> `mode → 默认信号` 回退映射：`image→image-generate`、`chat→image-generate`、`ecommerce→ecommerce`（ecommerce 沿用现有电商 persona，不进 `INTENT_PERSONA` 也可）。

**验收**：不传 `intentSignal` 时输出与当前一致；传 `image-edit` 时系统提示词含"仅""指定区域""保持一致"等约束词。

### Phase 2（PR-2）前端接线 + 方向可视化
1. `creation-panel.tsx` 魔术棒 handler：构造 `IntentRouterInput` 调 `resolveIntent`，把 `primarySignal/confidence` 塞进 `context`。
2. `api-client.ts` `optimizePromptApi`：透传新 context 字段，返回体解析 `direction/directionLabel`。
3. UI：润色后把 `directionLabel` 展示进现有 `polishHint`（如"OpenAI · 局部编辑"）。
4. 未登录/无 token 分支保持模板回退（可用 mode 映射本地 label）。

**验收**：点击魔术棒后气泡显示方向标签；E2E 断言回填 + 标签出现。

### Phase 3（PR-3）结构化输出 + 备选切换
1. 后端 provider 支持返回 `variants`（prompt 要求模型给 1 推荐 + ≤2 备选，或二次轻量生成）。
2. `PromptOptimizeResult.variants` 落地；模板兜底可为空。
3. 前端：润色气泡旁"换一个"按钮循环 `variants`，点击即回填。

**验收**：有 variants 时可切换回填；无 variants 时按钮隐藏。

### Phase 4（PR-4）个性化（千人千面）
1. 数据源：用户最近被采纳的润色结果（起步可前端本地缓存最近 N 条，或后端按用户查询）。
2. `context.recentAccepted?: string[]`（≤3 条，各 ≤200 字）注入系统提示词作为 few-shot。
3. "采纳"判定：润色回填后用户未大幅修改即提交 → 记为采纳（前端埋点/本地存）。

**验收**：注入范例后风格向用户历史靠拢；不传时行为不变。

### Phase 5（PR-5，可选）低置信澄清一问
1. L1 `confidence < 0.4` 且输入过短 → 弹一个 chip 问题（方向二选一）。
2. 用户选择后修正 `intentSignal` 再走 L2–L4。
3. 高置信永远跳过，保持一键直出。

**验收**：低置信触发澄清；高置信不打断。

---

## 变更记录
- v0.3（2026-07-06）：PR-1（#284）已合并部署；PR-2 前端接线（魔术棒 `resolveIntent` 注入意图 + `directionLabel` 展示）开发中。
- v0.2（2026-07-05）：追加附录 A 各 Phase 实现细则与 `INTENT_PERSONA` 草稿。
- v0.1（2026-07-05）：初稿。确立四层架构、意图矩阵、context/响应契约、PR 分期。
