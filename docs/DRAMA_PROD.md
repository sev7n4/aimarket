# AI 短剧生产检查清单

生产环境：`http://119.29.173.89:3100`（Web） / `:4100`（API）

## 部署前

- [ ] `AGENT_DRAMA_PLAN_MODEL` + LLM Key 已配置（否则规划走规则引擎）
- [ ] 图像 Provider：`omni-v2` auto 链可用（Agnes → 万相 → Seedream）
- [ ] 视频 Provider：万相 / Seedance Key 有效
- [ ] `pnpm typecheck` + CI 全绿

## 部署后冒烟

```bash
# 健康检查
curl -sf http://119.29.173.89:4100/health

# 会话状态 API（需登录 token）
curl -H "Authorization: Bearer $TOKEN" \
  http://119.29.173.89:4100/api/v1/drama/sessions/{sessionId}/state

# 全链路验收（规划 → 制作，约 5–30 分钟）
API_URL=http://119.29.173.89:4100 \
PROD_EMAIL=user001@163.com PROD_PASSWORD=... \
node scripts/test-drama-prod-e2e.mjs

# 侧栏切换画布（Playwright，需 apps/web 依赖）
cd apps/web && pnpm exec node ../../scripts/verify-prod-session-switch.mjs
```

## 手工验收（user001）

1. Studio → 个人空间 → 侧栏点击另一画布，URL `sessionId` 与标题应同步变化
2. 刷新页面后短剧规划/制作态应恢复（Phase 8.7）
3. 创意设计 → AI 短剧 → 规划 → 确认制作
4. 积分不足时应 `waiting_confirm`，不应静默失败

## 已知运维项

| 现象 | 处理 |
|------|------|
| 规划摘要含「规则引擎」 | 检查百炼/LLM 欠费与 `AGENT_DRAMA_PLAN_MODEL` |
| Agent 职责 / prompt 迭代 | 见 [agents/drama/README.md](./agents/drama/README.md) |
| char_refs 500 | 确认 auto 回落链；#195 已合入 |
| 制作长时间 running | 查 `drama_runs` 与 job 队列；可单步 retry |

## 相关脚本

| 脚本 | 用途 |
|------|------|
| `scripts/test-drama-prod-e2e.mjs` | 生产全链路 |
| `scripts/test-drama-plan-rerun.mjs` | PATCH + rerun |
| `scripts/test-drama-session-recover.mjs` | 会话状态 API |
| `scripts/verify-prod-session-switch.mjs` | 侧栏切换 UI |
