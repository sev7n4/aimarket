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
| **镜像交付** | 推 GHCR，`sha` tag，服务器 `pull` | 自建 runner **仅推 TCR**；服务器 **仅拉 TCR**；GHCR 手动镜像 ✅ |
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
| `TCR_USERNAME` | — | ✅ **必填**（TCR 登录用户名） |
| `TCR_PASSWORD` | — | ✅ **必填**（TCR 访问凭证/长期令牌） |
| `SMTP_*` / `DEPLOYMENT_NOTIFICATION_EMAIL` | 可选 | 可选（邮件步骤 `continue-on-error`） |

**不要复用**：

- `TENCENT_CLOUD_PROJECT_DIR`（指向拼兔兔目录）
- `TENCENT_CLOUD_PROJECT_DIR`（拼兔兔专用；AIMarket 固定 `/opt/aimarket`）

**Repository Variables**（可选，有默认值）：

| Variable | 默认 | 说明 |
|----------|------|------|
| `TCR_REGISTRY` | `ccr.ccs.tencentyun.com` | 个人版 TCR；企业版填 `*.tencentcloudcr.com` |
| `TCR_NAMESPACE` | `aimarket` | TCR 命名空间，须与控制台一致 |

**自建 runner（可选）**：默认 Deploy 在 `ubuntu-latest` 构建并推 TCR；若有同地域专用 CVM，可注册标签 `aimarket-build` 以缩短跨境 push（见下文「构建机」）。

可选 **Repository variable**（仿 pintuotuo `DEPLOY_VERIFY_*`）：

- `DEPLOY_VERIFY_API_URL` — 覆盖默认 `http://IP:4100`（一般不必）

### 一次性：开通 TCR 并配置 GHA

**逐步操作见 [TCR_PERSONAL_SETUP.md](./TCR_PERSONAL_SETUP.md)**（个人版免费，`ccr.ccs.tencentyun.com`）。

摘要：控制台初始化个人版密码 → 命名空间 `aimarket` → GitHub `production` 添加 `TCR_USERNAME`（账号 ID）与 `TCR_PASSWORD`（固定密码）。

镜像地址示例：

- 生产拉取：`ccr.ccs.tencentyun.com/aimarket/aimarket-api:<sha>`
- GHCR 备份：`ghcr.io/sev7n4/aimarket-api:<sha>`（**手动** workflow `ghcr-backup.yml`，从 TCR 复制 manifest）

## 构建机（可选 self-hosted `aimarket-build`）

当前 **默认** `deploy.yml` 的 `build-push` 为 `runs-on: ubuntu-latest`（无需额外机器）。跨境推 TCR 可能较慢（API 镜像曾达 60+ 分钟）。

若后续有与 TCR 同地域的专用 CVM（建议 4C8G+、50GB+ 盘，与生产机分离），可注册 runner 并自行将 workflow 改为 `runs-on: [self-hosted, aimarket-build]`：

```bash
# GitHub → Settings → Actions → Runners → New self-hosted runner → 复制 token
export RUNNER_URL="https://github.com/sev7n4/aimarket"
export RUNNER_TOKEN="<一次性 registration token>"
export RUNNER_NAME="aimarket-build-1"
sudo -E bash deploy/bootstrap-github-runner.sh
```

脚本：`deploy/bootstrap-github-runner.sh`。

## main 合并节奏

见 **[DEPLOY_MERGE_POLICY.md](./DEPLOY_MERGE_POLICY.md)**：合并间隔、保留 `cancel-in-progress`、下一单 PR 前等待 Deploy 成功。

## 镜像与磁盘清理

| 层级 | 策略 |
|------|------|
| **TCR** | 每次 deploy 仅推 `:${{ github.sha }}` + `:latest`；**服务器仅 pull TCR**（通常 &lt;2 分钟） |
| **GHCR** | 不自动推；`ghcr-backup.yml` 按需镜像；可选清理保留 15 版 |
| **服务器** | `pull` **前**先删旧 TCR tag + builder prune；`pull` 后再 `image prune`；可用空间 &lt;2GB 时 `image prune -af` |
| **应急** | SSH 执行 `sudo bash /opt/aimarket/deploy/cleanup-disk.sh`（见 `deploy/cleanup-disk.sh`） |

手动回滚（需已 `docker login` TCR）：

```bash
cd /opt/aimarket
export IMAGE_TAG=<previous-sha>
export TCR_REGISTRY=ccr.ccs.tencentyun.com
export TCR_NAMESPACE=aimarket
# echo "$TCR_PASSWORD" | docker login "$TCR_REGISTRY" -u "$TCR_USERNAME" --password-stdin
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
| `Deploy` | push main（非仅 docs）+ manual | 自建 runner 仅推 TCR、scp、服务器 **TCR pull**、验证 |
| `Mirror TCR → GHCR` | manual | `ghcr-backup.yml`，按 `image_tag` 备份 |

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
- **合并 main**：等待 **Deploy** 成功后再合并下一单（见 [DEPLOY_MERGE_POLICY.md](./DEPLOY_MERGE_POLICY.md)）
- **手动部署**：Actions → Deploy → Run workflow → 选分支
- **GHCR 备份**：Actions → Mirror TCR images to GHCR → 填已部署的 `image_tag`（git sha）

## 注意事项

- 勿修改 `/opt/pintuotuo`。
- `.env` 仅存服务器 `/opt/aimarket/.env`。
- **业务密钥**（OpenAI、S3、Stripe 等）配置与轮换见 **[PRODUCTION_SECRETS.md](./PRODUCTION_SECRETS.md)**；模板文件 `deploy/.env.production.example`。
