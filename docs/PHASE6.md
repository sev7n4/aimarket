# Phase 6 子阶段说明（6A / 6B / 6C）

Phase 6 总目标：合规审核、多租户、性能与可运维性。

## 6A — 合规审核

| 能力 | 状态 | 说明 |
|------|------|------|
| 生成前内容审核 | ✅ | `MODERATION_PROVIDER`：`local` / `openai` / `http` / `auto` |
| OpenAI Moderations API | ✅ | 与 `OPENAI_API_KEY` 共用；失败回落本地规则 |
| 自定义 HTTP 审核 | ✅ | `MODERATION_HTTP_URL` + `MODERATION_HTTP_KEY` |
| 用户内容举报 | ✅ | `POST /api/v1/reports` |
| Admin 举报审核 | ✅ | `/admin` 举报列表 |
| AI 生成标注 | ✅ | Studio 顶栏、页脚 |
| 埋点限流 | ✅ | `POST /events` 按 IP 限流 |

环境变量见 `.env.example` 中 `MODERATION_*`。

## 6B — 多租户工作区

| 能力 | 状态 | 说明 |
|------|------|------|
| 个人工作区自动创建 | ✅ | 注册 / 列表时 `ensurePersonalWorkspace` |
| 历史数据回填 | ✅ | 启动 `seedDatabase` → `backfillWorkspaces` |
| 会话绑定 `workspace_id` | ✅ | `ensure` / `create` 写入 |
| 工作区列表 | ✅ | `GET /api/v1/workspaces/list` |
| 创建团队工作区 | ✅ | `POST /api/v1/workspaces/create` |
| 按工作区筛会话 | ✅ | `GET /imageSession/list?workspaceId=` |
| Studio 展示工作区名 | ✅ | 顶栏「工作区：个人空间」 |
| 成员邀请 / 切换工作区 UI | ✅ | `/join?code=`、Studio 侧栏工作区切换器 |

## 6C — 性能与限流

| 能力 | 状态 | 说明 |
|------|------|------|
| 注册 / 生成 / 电商 / 视频限流 | ✅ | 内存桶 |
| Redis 分布式限流 | ✅ | `RATE_LIMIT_STORE=redis` 或 `JOB_QUEUE=redis` |
| Redis 任务队列 | ✅ | Phase 5 `JOB_QUEUE=redis` |
| 移动端工作台 Sheet | ✅ | `<768px` 默认收起 |
| CDN / 对象存储 | ✅ | `STORAGE_PROVIDER=s3` + `S3_PUBLIC_URL` CDN |
| PostgreSQL | ✅ 迁移就绪 | `db/migrations/postgres.sql` + bootstrap；默认仍 SQLite |

## Sprint 7（已完成）

- `POST /api/v1/events` 轻量埋点
- `studio_open`、`generation_submit`
- 首页匿名 `page_view`

## Sprint 8（本次）

- Admin 埋点看板 `GET /api/v1/admin/analytics`
- 生产部署文档 [DEPLOY.md](./DEPLOY.md)
