---
name: mydev-github-workflow
description: >-
  Automates AIMarket GitHub workflow: branch → TDD → local validation → PR →
  monitor CI + Integration + E2E in parallel → merge after approval → deploy.
  Use for bugs, features, refactors, or when the user asks to follow pintuotuo-style
  PR/CI discipline or run this end-to-end workflow.
---

# MyDev GitHub Workflow（AIMarket）

本 skill 位于 `.cursor/skills/mydev-github-workflow/`。`references/`、`scripts/` 路径均相对该目录。

与 **pintuotuo** 共用同一套 Step 0–14 与硬约束；差异见 `references/10_01_monitor_scripts.md`（工作流文件名、并行检查、本地命令）。

## 硬约束

```
[1] 禁止忽略 current_fix_cases 失败
[2] 禁止跳过状态文件更新（scripts/00_01_workflow_state.json）
[3] 禁止跳过本地验证（typecheck + integration）
[4] 禁止跳过 CI 监控：CI → Integration → E2E 全部通过
[5] 禁止 CI 未通过就合并 PR
[6] 业务逻辑改动须走 TDD（Step 5–7），见跳过条件
[7] 禁止直推 main；仅功能分支 → PR → Squash merge
```

重试上限：**5** 次，超限请求人工介入。

## 工作流链（摘要）

| 阶段 | 内容 |
|------|------|
| Phase 1 PR | Step 0–11：开发、PR、监控 CI/Integration/E2E |
| Phase 2 合并部署 | Step 12–14：合并、Deploy workflow、清理 |

**PR 触发（并行，非 pintuotuo 的 workflow_run 串链）**：

| Workflow 文件 | GitHub 显示名 | 必填检查名 |
|---------------|---------------|------------|
| `.github/workflows/ci.yml` | CI | `lint-typecheck`, `docker-build` |
| `.github/workflows/integration-tests.yml` | Integration Tests | `Integration Tests` |
| `.github/workflows/e2e-tests.yml` | E2E Tests | `E2E Tests` |

**合并后**：`push main` → `Deploy to Tencent Cloud (AIMarket)`（`.github/workflows/deploy.yml`）。

**注意**：向 feature 分支 `git push` **不会**跑 Integration/E2E；必须 **创建/更新 PR** 才触发。

## Step 8: 本地验证（AIMarket）

```bash
pnpm install --frozen-lockfile
pnpm typecheck

# 启动 API（mock，另开终端或后台）
cd apps/api
mkdir -p data-ci uploads-ci
# 写入 CI 用 .env（PORT=4000, IMAGE_PROVIDER=mock, JOB_QUEUE=memory 等）
pnpm exec tsx --env-file=.env src/index.ts

# 仓库根目录
API_URL=http://localhost:4000 ADMIN_SECRET=aimarket-admin-dev pnpm test:integration
```

可选 E2E（需 web 已 build + start）：

```bash
pnpm --filter @aimarket/web build
# NEXT_PUBLIC_API_URL=http://localhost:4000
pnpm --filter @aimarket/web start --port 3000
pnpm test:e2e
```

写入：`local_validation = passed`。

## Step 9–10: PR 与 CI 监控

```bash
git push -u origin {branch}
gh pr create --base main --title "{title}" --body-file ...
gh pr checks {pr-number} --watch
```

或按分支查 run：

```bash
gh run list --branch={branch} --limit 10
gh run view {run-id} --log-failed
```

监控顺序（逻辑上）：先等 **CI** 两 job → **Integration Tests** → **E2E Tests**；三者可并行触发，**全部 success** 才可 Step 12。

详见 `references/10_01_monitor_scripts.md`。

## Step 12: 合并

条件：上述检查全绿 + **至少 1 人 Approve**（仓库分支保护）。

```bash
gh pr merge {pr-number} --squash --delete-branch
```

## Step 13: 部署

```bash
gh run list --workflow="deploy.yml" --limit 3
gh run watch {run-id}
```

验证：`http://{TENCENT_CLOUD_IP}:4100/health`、`http://{TENCENT_CLOUD_IP}:3100/`。

详见 `references/13_01_deploy_guide.md`。

## current_fix_cases（AIMarket 用例表）

设计/修复时必须在 Step 1 写入 `scripts/00_01_workflow_state.json` 的 `current_fix_cases`。

| ID | 范围 | 对应 |
|----|------|------|
| `INT-API-SMOKE` | Integration | `scripts/smoke-api.mjs` 全量 |
| `INT-WS-SWITCH` | Integration | `scripts/test-workspace-switch.mjs` |
| `INT-WS-COLLAB` | Integration | `scripts/test-workspace-collab.mjs` |
| `INT-MOD-P2` | Integration | `scripts/verify-moderation-p2.mjs` |
| `E2E-SMOKE-001` | E2E | Playwright「首页展示品牌标题」 |
| `E2E-SMOKE-002` | E2E | Playwright「注册后可看到积分」 |
| `E2E-SMOKE-003` | E2E | Playwright「项目页可打开」 |

E2E 合并条件：**current_fix_cases 中列出的 E2E 用例必须通过**；未列入的 E2E 失败在 skill 下可记为技术债，但默认 **smoke 全绿** 才合并。

## 参考文档

| 文件 | 用途 |
|------|------|
| `references/00_01_state_fields.md` | 状态 JSON 字段 |
| `references/01_01_issue_parsing.md` | 问题类型与用例 ID |
| `references/09_01_pr_template.md` | PR/Commit 模板 |
| `references/10_01_monitor_scripts.md` | gh 监控命令（AIMarket） |
| `references/13_01_deploy_guide.md` | 部署与回滚 |
| `references/05_03_test_case_registry.md` | 用例注册表 |

## pintuotuo 对照

| 项 | pintuotuo | AIMarket |
|----|-----------|----------|
| CI workflow | `ci-cd.yml` | `ci.yml` |
| Integration | `integration-tests.yml` | 同名 |
| E2E | `e2e-tests.yml` | 同名 |
| Deploy | `deploy-tencent.yml` | `deploy.yml` |
| 本地测试 | `make test` | `pnpm typecheck` + `pnpm test:integration` |
| 部署目录 | `/opt/pintuotuo` | `/opt/aimarket` |

后续 PR：**先读并执行本 skill**，再改代码。
