# 分支命名参考

> 本文档定义分支命名规则和 ISSUE ID 来源。

---

## 分支命名规则

**格式**: `{type}/issue-{id}`

| type | 说明 | 示例 |
|------|------|------|
| bugfix | Bug修复 | bugfix/issue-AUTH-001 |
| feature | 新功能 | feature/issue-USER-002 |
| enhancement | 优化改进 | enhancement/issue-PROD-003 |

---

## ISSUE ID 来源

**优先级**：
1. **用户提供**: 如果用户明确提供了 Issue 编号，使用该编号
2. **自动生成**: 如果没有，使用 Step 1 确定的 `{MODULE}-{SEQ}` 格式

**生成规则**：
- MODULE: 从 Step 1 获取 (AUTH, USER, PROD, ORD, PAY)
- SEQ: 从 `scripts/00_01_workflow_state.json` 的 `statistics.totalIssues` + 1 获取

---

## 分支创建命令

```bash
# 切换到 main 分支并拉取最新代码
git checkout main
git pull origin main

# 创建新分支
git checkout -b {type}/issue-{id}
```

---

## 异常处理

| 场景 | 处理方式 |
|------|----------|
| 分支已存在 | 切换到现有分支: `git checkout {branch-name}` |
| main 分支不是最新 | 执行 `git pull origin main` |
| 没有 git 仓库 | 执行 `git init && git remote add origin {url}` |
| 远程仓库连接失败 | 检查网络连接和仓库权限 |

---

## 示例

```
用户输入: "登录失败，Issue-123 已经记录"
→ ISSUE ID: 123
→ 分支: bugfix/issue-123

用户输入: "登录失败"
→ Step 1 确定 MODULE: AUTH
→ SEQ: 001 (假设 totalIssues = 0)
→ ISSUE ID: AUTH-001
→ 分支: bugfix/issue-AUTH-001
```

---

## 状态写入命令

```bash
# 更新 activeBranch
jq --arg branch "bugfix/issue-AUTH-001" '.activeBranch = $branch' scripts/00_01_workflow_state.json > tmp.json && mv tmp.json scripts/00_01_workflow_state.json

# 更新 workflowState.branchName
jq --arg branch "bugfix/issue-AUTH-001" '.workflowState.branchName = $branch' scripts/00_01_workflow_state.json > tmp.json && mv tmp.json scripts/00_01_workflow_state.json
```
