# 邮箱验证（魔法链接）+ Pending 积分

## 1. 数据模型

### `users` 新增列

| 列 | 类型 | 说明 |
|----|------|------|
| `email_verified_at` | TEXT / TIMESTAMPTZ NULL | 邮箱验证完成时间；NULL 表示未验证 |
| `pending_credits` | INTEGER DEFAULT 0 | 冻结积分（验证后并入 `credits`） |

**存量用户**：启动迁移时 `email_verified_at = created_at`（免验证 grandfather）。

### `email_verification_tokens`

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | TEXT PK | UUID |
| `user_id` | TEXT FK users | |
| `token_hash` | TEXT UNIQUE | SHA-256(hex)，不落库明文 |
| `expires_at` | TEXT | |
| `consumed_at` | TEXT NULL | 一次性消费 |
| `created_at` | TEXT | |

### `invite_redemptions` 新增列

| 列 | 说明 |
|----|------|
| `rewards_granted_at` | NULL = 邀请积分未发放；验证后发放 |

---

## 2. API

### `POST /api/v1/auth/register`

- 邮箱密码注册：`credits=0`，`pending_credits=REGISTER_BONUS`，`email_verified_at=NULL`
- 可信渠道（`@phone.aimarket` / `@wechat.aimarket` / `@test.local` / `E2E_RELAX_RATE_LIMIT`）：即时验证 + 直接 `credits`
- 响应 `user` 含 `email_verified`、`pending_credits`
- 未验证时发送验证邮件（开发环境日志输出链接）

### `POST /api/v1/auth/verify-email`

```json
{ "token": "<magic-link-token>" }
```

- 无需登录
- 校验 token → `email_verified_at` → `pending_credits` 转入 `credits` → 发放待处理邀请奖励
- 返回新 JWT + `user` + `credits_granted`

### `POST /api/v1/auth/resend-verification`

- 需 Bearer JWT
- 限流：邮箱 1/min，IP 10/h
- 已验证则 400

### 生成任务

- `createGenerationJob`：未验证邮箱用户 → `403 EMAIL_NOT_VERIFIED`

---

## 3. 魔法链接

```
{APP_PUBLIC_URL}/verify-email?token={raw_token}
```

- 有效期默认 24h（`EMAIL_VERIFICATION_TTL_HOURS`）
- 一次性；重复点击已消费 token → 友好提示

---

## 4. 环境变量

| 变量 | 说明 |
|------|------|
| `APP_PUBLIC_URL` | Web 根 URL，拼验证链接 |
| `MAIL_FROM` | 发件人 |
| `RESEND_API_KEY` | 可选；未配置则 `console` 打日志 |
| `EMAIL_VERIFICATION_TTL_HOURS` | 默认 24 |

---

## 5. PR 改动清单

| 区域 | 文件 |
|------|------|
| 规范 | `docs/spec/EMAIL_VERIFICATION.md` |
| DB | `apps/api/src/db/index.ts`, `postgres.sql` |
| 核心库 | `email-trust.ts`, `email-verification.ts`, `mail.ts`, `user-public.ts` |
| 邀请 | `invite.ts` |
| 生成 | `jobs.ts` |
| 路由 | `auth.ts`, `user.ts` |
| Web | `types.ts`, `api-client.ts`, `verify-email/page.tsx`, `login-dialog.tsx` |
| 测试 | `smoke-api.mjs`, `e2e/helpers/auth.ts` |
