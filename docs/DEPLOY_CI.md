# 容器化部署与 CI/CD

## 架构

| 组件 | 宿主机端口 | 说明 |
|------|------------|------|
| `aimarket-web` | **3100** | Next.js standalone |
| `aimarket-api` | **4100** | Hono + SQLite |
| 网络 | `aimarket-net` | 与 `pintuotuo-*` 容器隔离 |

访问（暂用 IP）：

- 前端：http://119.29.173.89:3100
- API：http://119.29.173.89:4100/health

## 一次性初始化（国内 CVM）

```bash
# 本机上传脚本后，或在克隆仓库后执行
sudo bash /opt/aimarket/deploy/bootstrap-server.sh
```

或手动（仓库为私有时用本机 `rsync` 同步代码，勿依赖 `git clone`）：

```bash
rsync -avz --exclude node_modules --exclude .git \
  -e "ssh -i ~/.ssh/tencent_cloud_deploy" \
  ./ root@119.29.173.89:/opt/aimarket/
```

```bash
sudo mkdir -p /opt/aimarket
sudo git clone https://github.com/sev7n4/aimarket.git /opt/aimarket
cd /opt/aimarket
cp deploy/.env.production.example .env
# 编辑 .env：JWT_SECRET、ADMIN_SECRET、URL
sudo docker compose -f deploy/docker-compose.prod.yml up -d --build
```

## 日常发布

### 自动（推荐）

`main` 分支 push 触发 [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)。

在 GitHub **Settings → Secrets and variables → Actions** 配置：

| Secret | 示例 |
|--------|------|
| `DEPLOY_HOST` | `119.29.173.89` |
| `DEPLOY_USER` | `root` |
| `DEPLOY_SSH_KEY` | `tencent_cloud_deploy` 私钥全文 |

并创建 Environment `production`（可选审批）。

若仓库为 **private**，需在服务器配置 `git pull` 凭据，或改为 CI 构建镜像后 `scp` 加载（当前 `deploy.yml` 已采用后者，不依赖服务器 `git clone`）。

### 手动（服务器）

```bash
cd /opt/aimarket
bash deploy/deploy-remote.sh
```

## CI（PR / push）

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml)：

- `pnpm typecheck` + API/Web 构建
- Docker 镜像构建校验（不推送仓库）

PR 仅跑 CI，**不部署**。

## 注意事项

- **勿**修改 `/opt/pintuotuo` 与拼兔兔 compose。
- 勿占用宿主机 **4000/6379/80**（拼兔兔已用）；AIMarket 使用 **3100/4100**。
- `.env` 仅存服务器，勿提交 Git。
- 生产 OpenAI 需配置 `OPENAI_BASE_URL` 或升配后再改 `IMAGE_PROVIDER=openai`。
