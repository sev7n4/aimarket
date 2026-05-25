# CI 监控（AIMarket）

## 触发逻辑

```
创建/更新 PR → 并行触发：
  1) CI (ci.yml)           → lint-typecheck, docker-build
  2) Integration Tests     → smoke-api + workspace + moderation-p2
  3) E2E Tests             → Playwright smoke (apps/web/e2e/smoke.spec.ts)

合并 PR → push main → Deploy to Tencent Cloud (AIMarket)
```

**与 pintuotuo 差异**：pintuotuo 文档写 Integration/E2E 为 workflow_run 串链；**本仓库三个 workflow 均在 `pull_request` 上独立触发**，应用 `gh pr checks` 等待全部完成。

---

## 推荐：PR Checks 一把梭

```bash
PR=123  # 或 gh pr view --json number -q .number
gh pr checks "$PR" --watch
```

全部 required 为 **pass** 后进入 Step 12。

---

## 分 workflow 监控

### CI

```bash
gh run list --workflow=ci.yml --branch={branch} --limit 3
gh run watch {run-id}
# 失败日志
gh run view {run-id} --log-failed
```

必填 job：`lint-typecheck`、`docker-build`。

### Integration Tests

```bash
gh run list --workflow=integration-tests.yml --branch={branch} --limit 1
gh run watch {run-id}
```

对应脚本：`smoke-api.mjs`、`test-workspace-switch.mjs`、`test-workspace-collab.mjs`、`verify-moderation-p2.mjs`。

### E2E Tests

```bash
gh run list --workflow=e2e-tests.yml --branch={branch} --limit 1
gh run watch {run-id}
```

PR 默认 **smoke tier**（chromium，3 条用例）。`current_fix_cases` 含 `E2E-SMOKE-*` 时，日志中这些用例不得 FAIL。

---

## 分支保护必填检查名

在 GitHub **Settings → Branches → main** 勾选：

- `lint-typecheck`
- `docker-build`
- `Integration Tests`
- `E2E Tests`

并开启 **Require pull request reviews**（≥1）。

---

## 状态写入

```bash
STATE=".cursor/skills/mydev-github-workflow/scripts/00_01_workflow_state.json"
jq '.ci_status.cicd = "passed"' "$STATE" > tmp && mv tmp "$STATE"
jq '.ci_status.integration = "passed"' "$STATE" > tmp && mv tmp "$STATE"
jq '.ci_status.e2e = "passed"' "$STATE" > tmp && mv tmp "$STATE"
```

---

## 超时

| 阶段 | 建议超时 |
|------|----------|
| CI | 20 min |
| Integration | 15 min |
| E2E | 25 min |
| Deploy | 30 min |

超时 → `gh run cancel {id}` → Step 11。
