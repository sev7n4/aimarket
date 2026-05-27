# 容器化部署与 CI/CD

## 与 pintuotuo 工作流对照

| 维度 | pintuotuo | AIMarket（当前） |
|------|-----------|------------------|
| **CI 工作流** | `ci-cd.yml` | `ci.yml` |
| **集成测试** | `integration-tests.yml` | `integration-tests.yml` ✅ |
| **E2E** | `e2e-tests.yml` | `e2e-tests.yml` ✅ |
| **部署工作流** | `deploy-tencent.yml`（独立） | `deploy.yml`（独立）✅ 同模式 |
| **PR 触发** | CI + Integration + E2E，**不部署** | 同 ✅ |
| **main push** | CI + 部署（合并后） | CI + 部署 ✅ |
| **手动部署** | `workflow_dispatch` + 选 `branch` | 同 ✅ |
| **Environment** | `production` | `production` ✅ 可共用 Secrets |
| **SSH Secrets** | `TENCENT_CLOUD_*` | 优先读 `TENCENT_CLOUD_*`，兼容 `DEPLOY_*` |
| **部署目录** | `TENCENT_CLOUD_PROJECT_DIR` → `/opt/pintuotuo` | 固定 `/opt/aimarket`（勿混用） |
| **镜像交付** | 推 GHCR，`sha` tag，服务器 `pull` | 同 ✅ `ghcr.io/sev7n4/aimarket-{api,web}:${sha}` |
| **部署后验证** | `/api/v1/health` + catalog | `/health` + Web 200 |
| **通知** | Summary + 邮件（SMTP） | 同（邮件可选） |

## 触发方式（可与 pintuotuo 保持一致）

```yaml
# deploy.yml — 与 deploy-tencent.yml 同款
on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      branch: { default: main }

# ci.yml — 与 ci-cd.yml 同款（PR 仅 pull_request；push 仅 main）
on:
  push:
    branches: [main]
    paths-ignore: ["**/*.md", "docs/**"]
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened, ready_for_review]

# integration-tests.yml / e2e-tests.yml — PR 阶段仅 pull_request
on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened, ready_for_review]
```

**结论**：触发策略可以**完全复用**；无需把 AIMarket 部署并进 pintuotuo 仓库的工作流（两项目应各用各的 workflow 文件）。

## Secrets / Variables 复用

**可直接复用**（Organization 或 Environment `production` 级配置一次即可）：

| Secret | pintuotuo | AIMarket |
|--------|-----------|----------|
| `TENCENT_CLOUD_IP` | ✅ | ✅ |
| `TENCENT_CLOUD_USER` | ✅ | ✅ |
| `TENCENT_CLOUD_SSH_KEY` | ✅ | ✅ |
| `SMTP_*` / `DEPLOYMENT_NOTIFICATION_EMAIL` | 可选 | 可选（邮件步骤 `continue-on-error`） |

**不要复用**：

- `TENCENT_CLOUD_PROJECT_DIR`（指向拼兔兔目录）
- `TENCENT_CLOUD_PROJECT_DIR`（拼兔兔专用；AIMarket 固定 `/opt/aimarket`）

可选 **Repository variable**（仿 pintuotuo `DEPLOY_VERIFY_*`）：

- `DEPLOY_VERIFY_API_URL` — 覆盖默认 `http://IP:4100`（一般不必）

## 镜像与磁盘清理

| 层级 | 策略 |
|------|------|
| **GHCR** | 每次部署 push `:${{ github.sha }}` + `:latest`；workflow 末尾保留每包 **15** 个版本 |
| **服务器** | `pull` 后 `docker image prune -f`；删除非当前 `IMAGE_TAG` / `latest` 的旧 GHCR 本地 tag；移除历史 `aimarket-*:release` 本地镜像 |
| **构建缓存** | `docker builder prune -f --filter until=72h`（部署脚本内，失败忽略） |

手动回滚（需已登录 GHCR）：

```bash
cd /opt/aimarket
export IMAGE_TAG=<previous-sha>
export GHCR_OWNER=sev7n4
bash deploy/deploy-remote.sh
```

访问仍为 **HTTP**（暂不上 HTTPS）：`http://<IP>:3100` / `:4100`。

## 架构

| 组件 | 宿主机端口 | 说明 |
|------|------------|------|
| `aimarket-web` | **3100** | Next.js standalone |
| `aimarket-api` | **4100** | Hono + SQLite |
| 网络 | `aimarket-net` | 与 `pintuotuo-*` 隔离 |

访问（暂用 IP）：

- 前端：http://119.29.173.89:3100
- API：http://119.29.173.89:4100/health

## 一次性初始化（国内 CVM）

```bash
sudo bash /opt/aimarket/deploy/bootstrap-server.sh
```

私有库可用 rsync：

```bash
rsync -avz --exclude node_modules --exclude .git \
  -e "ssh -i ~/.ssh/tencent_cloud_deploy" \
  ./ root@119.29.173.89:/opt/aimarket/
```

Agent/开发者 PR 全流程见 **[PR_WORKFLOW.md](./PR_WORKFLOW.md)**（`mydev-github-workflow` skill，与 pintuotuo 一致）。

## 分支保护（合并前全绿 + 审核，合并后才部署）

在 **Settings → Branches → Branch protection rules → main** 配置：

1. **Require a pull request before merging**，至少 **1** 名审核人（`Require approvals`）
2. **Require status checks to pass before merging**，勾选：
   - `lint-typecheck`（CI）
   - `docker-build`（CI）
   - `Integration Tests`（Integration Tests workflow）
   - `E2E Tests`（E2E Tests workflow）
3. **Require branches to be up to date before merging**（建议开启）
4. 勿勾选「合并后仍允许绕过」类选项（按团队规范）

说明：**Deploy** 仅在 **合并到 main 的 push** 时运行；PR 阶段不会部署生产。

## 工作流一览

| Workflow | 触发 | 内容 |
|----------|------|------|
| `CI` | PR + push main | typecheck、build、Docker 构建校验 |
| `Integration Tests` | PR + manual | `smoke-api`、工作区脚本、`verify-moderation-p2` |
| `E2E Tests` | PR + cron + manual | Playwright 冒烟（`apps/web/e2e/smoke.spec.ts`） |
| `Deploy` | push main（非仅 docs）+ manual | GHCR push、scp compose、服务器 pull、清理、curl 验证 |

本地：

```bash
# 先启动 API（另开终端）
cd apps/api && cp ../../.env.example .env  # 按需改 mock
pnpm exec tsx --env-file=.env src/index.ts

pnpm test:integration
pnpm test:e2e   # 需 API + web dev 或 build+start
```

## 日常发布

- **PR**：`CI` + `Integration Tests` + `E2E Tests` 全部通过 + 审核批准
- **合并 main**：`Deploy to Tencent Cloud (AIMarket)` 自动执行
- **手动**：Actions → Deploy workflow → Run workflow → 选择分支

## 注意事项

- 勿修改 `/opt/pintuotuo`。
- `.env` 仅存服务器 `/opt/aimarket/.env`。
- **业务密钥**（OpenAI、S3、Stripe 等）配置与轮换见 **[PRODUCTION_SECRETS.md](./PRODUCTION_SECRETS.md)**；模板文件 `deploy/.env.production.example`。
