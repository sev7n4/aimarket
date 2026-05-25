# AIMarket 测试用例注册表

供 Step 1 `current_fix_cases` 选用。

## Integration（API 脚本）

| ID | 脚本 | 说明 |
|----|------|------|
| `INT-API-SMOKE` | `scripts/smoke-api.mjs` | 注册/会话/生成/工作区/管理端 |
| `INT-WS-SWITCH` | `scripts/test-workspace-switch.mjs` | 个人/团队列表隔离 |
| `INT-WS-COLLAB` | `scripts/test-workspace-collab.mjs` | 方案 B 只读协作 |
| `INT-MOD-P2` | `scripts/verify-moderation-p2.mjs` | 出图审核 + 埋点 |

## E2E（Playwright `apps/web/e2e/smoke.spec.ts`）

| ID | 用例标题 |
|----|----------|
| `E2E-SMOKE-001` | 首页展示品牌标题 |
| `E2E-SMOKE-002` | 注册后可看到积分 |
| `E2E-SMOKE-003` | 项目页可打开 |

## 映射规则

| 改动范围 | 建议 current_fix_cases |
|----------|------------------------|
| 认证/登录/注册 | `INT-API-SMOKE`, `E2E-SMOKE-002` |
| 工作区/协作 | `INT-WS-SWITCH`, `INT-WS-COLLAB`, `E2E-SMOKE-003` |
| 生成/审核/埋点 | `INT-API-SMOKE`, `INT-MOD-P2` |
| 仅前端 UI 文案 | `E2E-SMOKE-001` |
| 全栈大改 | 上表全部 |

## CI 对应关系

PR 上 Integration job **全量**跑四个脚本；E2E job **全量**跑 smoke 三用例。`current_fix_cases` 用于 Agent 判断「本次改动必须关心的失败项」，合并前仍须 **四个 Integration + E2E job 全绿**（与分支保护一致）。
