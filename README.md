# AIMarket

中文 AI 修图与电商设计平台（对标椒图 AI 产品能力）。支持对话式改图、快速出图、电商套图 Agent，以及多模型智能路由。

## 技术栈

| 包 | 说明 |
| --- | --- |
| `apps/web` | Next.js 15 App Router + Tailwind CSS v4 |
| `apps/api` | Hono REST API（模型列表、积分预估、会话占位） |
| `packages/ui` | 共享 UI：玻璃面板、模式 Tab、按钮 |

## 快速开始

```bash
# 安装依赖
pnpm install

# 复制环境变量
cp .env.example .env

# 同时启动前端与 API
pnpm dev

# 或分别启动
pnpm dev:web   # http://localhost:3000
pnpm dev:api   # http://localhost:4000
```

## 页面

- `/` — 营销首页（Hero + 三模式输入 + 灵感瀑布流）
- `/studio?sessionId=...&mode=chat|quick|ecommerce` — 创作工作台
- `/about` — 品牌介绍
- `/settings` — 品牌 Kit（主色/Logo）
- `/admin` — 管理看板（需管理密钥）
- `/invite` — 邀请有礼

## API 接口（节选）

- `GET /health`
- `GET /api/v1/ai/queryModels`
- `POST /api/v1/ai/estimatePointsBatch`
- `GET /api/v1/imageSession/queryImageSessionRequestMode?sessionId=`
- `GET /api/v1/productSet/init`
- `POST /api/v1/productSet/generate` — 电商套图（4 张）
- `POST /api/v1/ai/suggestModel` — 智能路由建议
- `GET /api/v1/imageSession/:id/references` — @ 可引用历史图
- `GET /api/v1/tools/list` · `POST /api/v1/tools/:id/run`
- `GET /api/v1/product/packages` · `POST /api/v1/product/purchase`（模拟支付）
- `GET /api/v1/sign/check` · `POST /api/v1/sign/in`
- `GET /api/v1/inviteUser/generateCode`
- `GET /api/v1/notice/latestNotice`
- `GET /api/v1/ai/jobs/:jobId/stream` — SSE 任务状态
- `POST /api/v1/ai/generate/video` — 视频生成（Mock）
- `GET|PUT /api/v1/brandKit` — 品牌 Kit
- `PATCH /api/v1/imageSession/:id` — 重命名会话/项目
- `DELETE /api/v1/imageSession/:id` — 删除会话/项目
- `GET|PUT /api/v1/imageSession/:id/canvas` — 画布布局持久化
- `GET /api/v1/imageSession/:id/export` — 会话导出
- `GET /api/v1/workspaces/list` — 用户工作区列表
- `POST /api/v1/workspaces/create` · `POST /api/v1/workspaces/join` — 团队空间与邀请加入
- `POST /api/v1/workspaces/:id/invites` · `GET .../members` — 邀请链接与成员管理
- `POST /api/v1/reports` — 内容举报
- `POST /api/v1/events` — 埋点（匿名或带 Token）
- `GET /api/v1/admin/*` — 管理统计与举报审核（`X-Admin-Secret`）
- `POST /api/v1/product/checkout` — 创建待支付订单
- `POST /api/v1/product/orders/:id/confirm` — Mock 收银台确认
- `POST /api/v1/product/webhook/stripe` — Stripe 回调

环境变量见 `.env.example`（`JOB_QUEUE`、`REDIS_URL`、`PAYMENT_PROVIDER`、`STRIPE_*`、`VIDEO_API_*`）。

## 文档

- [产品需求规格书（PRD）](./docs/PRD.md)
- [产品文档](./docs/PRODUCT.md)
- [技术规格书](./docs/TECH_SPEC.md)
- [椒图 AI 竞品调研报告](./docs/research/JIAOTUAI_RESEARCH_REPORT.md)
- [椒图对标 · 架构优化方案](./docs/spec/JIAOTU_OPTIMIZED_DESIGN.md)（**开工前必读**）
- [椒图对标 API 草案](./docs/spec/JIAOTU_PARITY_API.md)
- [椒图对标任务排期](./docs/spec/JIAOTU_PARITY_BACKLOG.md)

## 路线图

- [x] Phase 0：Monorepo + Design System + 首页/Studio 骨架
- [x] Phase 1：登录、上传、对话生成、积分扣费、会话历史
- [x] Phase 2：电商套图 Agent、智能路由、Studio 工具、@ 引用历史图
- [x] Phase 3：积分套餐（模拟充值）、每日签到、邀请有礼、运营公告
- [x] Phase 4：Provider 抽象、SSE 任务流、视频 Mock、品牌 Kit、管理后台、会话导出
- [x] Phase 5：Checkout 支付（Mock/Stripe）、Redis/BullMQ 队列、视频 HTTP Provider
- [x] Sprint 1（体验收尾）：画布/工作台拆分、项目重命名删除、新建入口统一
- [x] Phase 6：6A 外部内容审核、6B 多租户工作区、6C Redis 限流（见 [docs/PHASE6.md](./docs/PHASE6.md)）
- [x] Sprint 7：轻量埋点 + 首页匿名 `page_view`
- [x] Sprint 8：Admin 埋点看板 + [生产部署清单](./docs/DEPLOY.md)
- [x] Sprint 9：工作区邀请/切换、S3 CDN 对象存储、PostgreSQL 迁移脚本
- [x] Sprint 2：真实图像 Provider（OpenAI 落盘、比例尺寸、Staging 文档）
- [x] Sprint 3：画布 2.0（布局持久化、拖拽、删除、上传上画布）
- [x] Sprint 4：session.kind 画布/项目 + 项目库筛选 + 电商套图完整表单

- [Phase 6 子阶段说明](./docs/PHASE6.md)
- [生产部署清单](./docs/DEPLOY.md)

发版前冒烟见 [docs/SMOKE_TEST.md](./docs/SMOKE_TEST.md)。

## License

Private — All rights reserved.
