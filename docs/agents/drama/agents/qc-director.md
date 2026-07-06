# Agent: qc-director（质检导演）

| 字段 | 值 |
|------|-----|
| id | `qc-director` |
| layer | L3 Production |
| order | —（制作完成后） |
| 实现 | `apps/api/src/lib/drama/planner/qc-director.ts` |

---

## 定位

**非 Plan 流水线成员**。在用户完成 `drama-short-v1` 制作、`drama_run.status === completed` 后可选触发，评估叙事连贯性与构图表现力。

与 Plan Agents 区别：

| 维度 | Plan Agents | qc-director |
|------|-------------|-------------|
| 时机 | 规划阶段 | 成片后 |
| 输入 | PlanningContext | DramaProjectData + shot audit |
| 输出 | 项目结构 JSON | DramaQcReport 分数 |
| 编排 | orchestrator 顺序链 | `runDramaRunQc` 独立调用 |

---

## Role / Goal

| 维度 | 定义 |
|------|------|
| **Role** | 短剧导演质检专家 |
| **Goal** | 输出 narrative/composition 分数与逐镜 note |
| **Goal（规则层）** | LLM 不可用时用 auditScore + 规则加权 |

---

## LLM Prompt（摘要）

System：

> 你是短剧导演质检专家。根据剧本与分镜评估叙事连贯性、构图表现力。输出严格 JSON：narrativeScore/compositionScore(0-100)、summary(中文)、shotNotes 数组含 shotId/narrativeScore/compositionScore/note。

User：`JSON.stringify({ title, logline, userIdea, shots: [...] })`

---

## 输出：DramaQcReport

| 字段 | 说明 |
|------|------|
| overallScore | 加权综合 0–100 |
| narrativeScore | 叙事 |
| compositionScore | 构图 |
| consistencyScore | 角色/风格 audit 均值 |
| shots[] | 逐镜分数 + note |
| provider | `llm+audit` / `rule+audit` / `error` |

---

## 与 auto-retry

`dispatchDramaRunQc` 完成后调用 `qc-auto-retry.ts` → 低分镜可触发自动重生成（受 `productionParams.autoQcRetry` 控制）。

---

## 演进

- 纳入 manifest pipeline 的 **post-production** 阶段（可选自动触发）
- QC persona 与 Plan director 分离，避免规划阶段过度保守
