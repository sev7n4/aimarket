# 问题解析（AIMarket）

## 类型 → 分支前缀

| 关键词 | 类型 | 分支 |
|--------|------|------|
| 失败、错误、bug | bugfix | `fix/` 或 `bugfix/` |
| 新增、功能 | feature | `feature/` |
| 优化、重构 | enhancement | `enhancement/` |

## 模块 → MODULE

| 关键词 | MODULE |
|--------|--------|
| 登录、注册、JWT | AUTH |
| 会话、画布、项目 | SESSION |
| 工作区、邀请、协作 | WS |
| 生成、模型、任务 | AI |
| 审核、埋点 | MOD |
| 管理端 | ADMIN |
| 前端页面、Next | WEB |

## current_fix_cases 格式

`{TYPE}-{MODULE}-{SEQ}` 或上表固定 ID（推荐直接用注册表 ID，如 `E2E-SMOKE-002`）。

完整列表见 `references/05_03_test_case_registry.md`。

## 示例

```
输入: "成员不能编辑他人会话"
→ fix/readonly-member
→ current_fix_cases: ["INT-WS-COLLAB", "E2E-SMOKE-003"]

输入: "注册后首页不显示积分"
→ fix/register-credits-ui
→ current_fix_cases: ["E2E-SMOKE-002", "INT-API-SMOKE"]
```
