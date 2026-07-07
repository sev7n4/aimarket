# PR 与工作流规范

AIMarket 与 **pintuotuo** 对齐，使用同一套 Agent Skill：**`.cursor/skills/mydev-github-workflow/SKILL.md`**。

## 开发者 / Agent 怎么做

1. 在 Cursor 中处理需求、修 bug、提 PR 时，**自动遵循** `mydev-github-workflow` skill（见 `.cursorrules`）。
2. **不要**直接 `git push origin main`。
3. 流程：功能分支 → 本地 `pnpm typecheck` + `pnpm test:integration` → PR → 等 CI 全绿 → 审核 → Squash merge → Deploy。

## GitHub 仓库设置（一次性）

**Settings → Branches → main**：

- Require pull request + **1 approval**
- Require status checks：
  - `lint-typecheck`
  - `docker-build`
  - `Integration Tests`
  - `E2E Tests`

## Studio / 画布 PR 自检（P5-3）

涉及 `design-canvas`、`studio-workspace`、Infinite/Scroll/Free 画布或 Dock 的 PR，描述中请注明：

- [ ] 受影响画布模式：Infinite / Scroll / Free / 无
- [ ] 是否动提交主线（`useStudioSubmit` / `runStudioSubmit` / CreationPanel）
- [ ] 合并部署后是否需跑 [PROD_SMOKE_INFINITE.md](./PROD_SMOKE_INFINITE.md)


| 相同 | 不同 |
|------|------|
| Step 0–14、硬约束、状态 JSON、Squash merge | CI 文件名为 `ci.yml` |
| PR 跑 Integration + E2E | 检查**并行**触发（非 workflow_run 串链） |
| 合并后才 Deploy | 部署 workflow：`deploy.yml`，目录 `/opt/aimarket` |
| | 本地验证：`pnpm` + `scripts/*.mjs` |

## 文档索引

- Skill 正文：`.cursor/skills/mydev-github-workflow/SKILL.md`
- 用例表：`references/05_03_test_case_registry.md`
- CI/Secrets：`docs/DEPLOY_CI.md`
