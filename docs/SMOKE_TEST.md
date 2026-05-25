# AIMarket 冒烟测试清单

每次发版或合并 `main` 前，在本地 `pnpm dev`（Web 3000 + API 4000）下逐项勾选。

## 环境

- [ ] `.env` 已配置 `NEXT_PUBLIC_API_URL=http://localhost:4000`
- [ ] API 已启动且无启动报错
- [ ] 修改 API 代码后已重启（CORS / 路由变更必须重启）

## 账户

- [ ] 注册 / 登录成功，刷新页面仍保持登录
- [ ] Header 显示积分余额
- [ ] 签到（可选）不报错

## 创作主路径

- [ ] 首页输入 prompt → 跳转 Studio 并可提交生成
- [ ] Studio 对话生成 → 工作台有消息、画布有结果图
- [ ] SSE / 轮询结束后积分正确扣减

## 项目与会话

- [ ] 左侧「新建画布」→ 标题为「新建画布」或「未命名」
- [ ] 左侧「新建项目」→ 标题为「新建项目」
- [ ] 顶栏「+」与左侧「新建项目」行为一致
- [ ] 顶栏 / 侧栏 / 项目库：重命名成功（无 Failed to fetch）
- [ ] 删除当前项目后跳转到新画布
- [ ] `/projects` 列表与删除后刷新一致

## 商业化（Mock）

- [ ] 积分套餐 → Mock 收银台 → 支付确认 → 积分增加
- [ ] Admin（`X-Admin-Secret`）可打开统计页

## 真实出图（Sprint 2，可选）

配置 `OPENAI_API_KEY` 且 `IMAGE_PROVIDER=openai` 时：

- [ ] Studio 横幅显示「真实出图」而非 Mock 演示提示
- [ ] 生成完成后图片 URL 为 `/uploads/...` 可访问
- [ ] 故意错误 Key 时任务失败且积分退回

详见 [STAGING.md](./STAGING.md)。

## 回归注意

- 重命名 / 删除依赖 CORS 允许 `PATCH`、`DELETE`
- 生产环境 `CORS_ORIGIN` 需与前端域名完全一致（含协议、端口）
