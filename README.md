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

## API 占位接口

- `GET /health`
- `GET /api/v1/ai/queryModels`
- `POST /api/v1/ai/estimatePointsBatch`
- `GET /api/v1/imageSession/queryImageSessionRequestMode?sessionId=`
- `GET /api/v1/productSet/init`

## 路线图

- [x] Phase 0：Monorepo + Design System + 首页/Studio 骨架
- [ ] Phase 1：真实生成任务队列 + 上传 + 登录
- [ ] Phase 2：电商 Agent 工作流 + 工具栏能力
- [ ] Phase 3：积分/套餐/邀请增长

## License

Private — All rights reserved.
