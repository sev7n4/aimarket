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

## 画布 2.0（Sprint 3）

- [ ] 生成图出现在画布，刷新后位置不变
- [ ] 选择工具拖拽图片，松手后刷新仍保持位置
- [ ] 上传图片直接出现在画布（标签「上传」）
- [ ] 选中后点删除工具或按 Delete 键可移除
- [ ] 手机宽度默认收起工作台，画布占满

## 项目类型（Sprint 4）

- [ ] 新建画布 → kind=canvas，标题默认「新建画布」
- [ ] 新建项目 → kind=project，项目库「项目」Tab 可筛到
- [ ] 电商模式：产品图 + 参考图预览，平台/市场/语言/分辨率可选，需产品图才可提交

## 真实出图（Sprint 2，可选）

配置 `OPENAI_API_KEY` 且 `IMAGE_PROVIDER=openai` 时：

- [ ] Studio 横幅显示「真实出图」而非 Mock 演示提示
- [ ] 生成完成后图片 URL 为 `/uploads/...` 可访问
- [ ] 故意错误 Key 时任务失败且积分退回

详见 [STAGING.md](./STAGING.md)。

## Phase 6（合规与多租户）

- [ ] `providerStatus` 含 `moderation.provider`（openai/local/http）
- [ ] 生成 prompt 含敏感词 → API 返回 `CONTENT_BLOCKED`
- [ ] Studio 顶栏可打开「举报」并提交成功
- [ ] Admin 后台「内容举报」列表可见待处理项，可标记已处理/驳回
- [ ] 登录后工作区名称显示（个人工作区自动创建）
- [ ] 窄屏（&lt;768px）工作台默认收起，点击「工作台」展开底部 Sheet

## Sprint 7（埋点）

- [ ] 打开首页后匿名 `page_view` 写入（无需登录）
- [ ] 登录进入 Studio 后 `studio_open` 事件写入
- [ ] 提交生成后 `generation_submit` 事件写入

## Sprint 8（运营）

- [ ] Admin「埋点统计」展示近 7 天事件汇总

## 自动化冒烟

```bash
node scripts/smoke-api.mjs
```

需 API 已启动且代码变更后已重启；期望 **22/22** 通过。

## 回归注意

- 重命名 / 删除依赖 CORS 允许 `PATCH`、`DELETE`
- 生产环境 `CORS_ORIGIN` 需与前端域名完全一致（含协议、端口）
