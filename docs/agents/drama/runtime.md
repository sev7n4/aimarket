# L4 Runtime — LLM 路由与协议

> 实现：`apps/api/src/lib/drama/planner/reasoning.ts`  
> 共享路由：`@aimarket/agent-core`（与 Studio Agent 同源）

---

## 1. 启用条件

| 变量 | 默认 | 说明 |
|------|------|------|
| `AGENT_LLM_ENABLED` | — | 全局 LLM 开关（agent-core） |
| `AGENT_DRAMA_PLAN_ENABLED` | `true` | 短剧多 Agent 模式；false 时走 single/rule |
| `AGENT_DRAMA_PLAN_MODEL` | — | 覆盖 primary provider 的 plan 专用模型 |
| `AGENT_DRAMA_PLAN_FALLBACK_MODEL` | — | planModel 失败时的第二模型 |
| `DRAMA_PLAN_THINK_ENABLED` | `false` | 开启 Think→Commit 两阶段 |

Primary provider 由 `AGENT_LLM_PRIMARY` 决定（deepseek / qwen / glm / …），plan 模型写入对应 `AGENT_LLM_*_MODEL` 环境变量（临时 override）。

---

## 2. Think → Commit 协议

业界「推理与结构化输出分离」模式（类似 o1/reasoner 摘要 + JSON commit）：

```
┌─────────────┐     ┌─────────────┐
│ Think 阶段   │ ──► │ Commit 阶段  │
│ 纯文本 ≤800字 │     │ jsonSchema  │
│ temp 0.5    │     │ temp 0.35   │
└─────────────┘     └─────────────┘
        │                    │
        └──── reasoning ─────┘
              (≤2000 字存 run + SSE)
```

1. **Think**（`DRAMA_PLAN_THINK_ENABLED=true`）：system 追加「先简要推理，不要 JSON」；结果截断至 2000 字
2. **Commit**：标准 system + user；若有 reasoning，追加 user 消息「请据此输出严格 JSON」
3. **Parse**：`JSON.parse(result.content)` → 由各 Agent runner 断言类型

Think 内容通过 `agent_reasoning` SSE 展示，不参与 merge 逻辑。

---

## 3. completeWithDramaPlanModels

```typescript
// 伪代码
try {
  return await runWithModel(AGENT_DRAMA_PLAN_MODEL);
} catch {
  if (AGENT_DRAMA_PLAN_FALLBACK_MODEL) {
    return await runWithModel(AGENT_DRAMA_PLAN_FALLBACK_MODEL);
  }
  throw;
}
```

模型 override 通过临时修改 `AGENT_LLM_{PRIMARY}_MODEL` 实现，调用后 restore。

---

## 4. runAgentStep（reasoning 层）

所有 Plan Agent 统一调用：

```typescript
runAgentStep<T>(
  agent: DramaPlanAgentId,  // 仅用于日志/扩展，当前未分支
  systemPrompt: string,
  userPrompt: string,
  jsonSchema: Record<string, unknown>,
): Promise<{ output: T; reasoning?: string }>
```

| 参数 | 来源 |
|------|------|
| systemPrompt | agents/*.ts（未来将迁 manifest） |
| userPrompt | 上游 context 拼接 + refineGuidance |
| jsonSchema | schemas.ts |

---

## 5. SSE 事件契约

定义：`apps/api/src/lib/drama/planner/types.ts`

| type | 字段 | 时机 |
|------|------|------|
| `agent_start` | `agent` | 步开始 |
| `agent_reasoning` | `agent`, `chunk` | Think 摘要 |
| `agent_done` | `agent`, `summary` | 步完成 |
| `agent_snapshot` | `agent`, `project` | partial merge 可用 |
| `project_snapshot` | `projectId`, `project` | PATCH 后全量 |
| `plan_complete` | `projectId`, `estimatedPoints`, … | 全链成功 |
| `plan_failed` | `error` | 不可恢复失败 |

制作阶段另有 `character_tool_*` / `scene_tool_*`（角色三视图、场景定稿），属 Skill 执行而非 Plan Agent。

---

## 6. Fallback 链

```
                    ┌──────────────────────┐
                    │ isAgentLlmEnabled?   │
                    └──────────┬───────────┘
                         no    │    yes
                          ▼    ▼
                   rule_based  isDramaMultiAgentPlanEnabled?
                                    │
                         no ────────┴──────── yes
                          ▼                      ▼
                    single_llm            multi_agent chain
                          │                      │
                          └──────────┬───────────┘
                                     ▼ fail
                              rule_based
```

规则引擎：`apps/api/src/lib/drama/planner.ts` → `buildRuleBasedProject`。

---

## 7. 生产配置示例

见 [DRAMA_PROD.md](../../DRAMA_PROD.md) 与 `deploy/.env.production.example`：

```bash
AGENT_LLM_ENABLED=true
AGENT_LLM_PRIMARY=deepseek
AGENT_DRAMA_PLAN_ENABLED=true
AGENT_DRAMA_PLAN_MODEL=deepseek-v4-pro
# AGENT_DRAMA_PLAN_FALLBACK_MODEL=qwen-max
# DRAMA_PLAN_THINK_ENABLED=true
```

规划摘要含「规则引擎」→ 检查 Key、欠费、`AGENT_DRAMA_PLAN_MODEL`。

---

## 8. 测试

| 脚本 | 覆盖 |
|------|------|
| `scripts/test-drama-agent.mjs` | 五 Agent 合并 shots 8–15 |
| `scripts/test-drama-plan.mjs` | plan run 完成 |
| `scripts/test-drama-plan-rerun.mjs` | 从 Agent 重跑 |

---

## 9. 演进

- **D1**：manifest.yaml `runtime.env` 与 deploy example 双向校验
- **D2**：systemPrompt 从 manifest 加载，reasoning.ts 只负责 Think/Commit 协议
- **D3**：按 Agent 配置独立 temperature / maxTokens
