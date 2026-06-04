# 部署监控（AIMarket）

## 触发

- **自动**：PR Squash 合并到 `main` 后 `push` 触发（`deploy.yml`；纯 `docs/**`、`*.md` 变更被 paths-ignore 跳过）
- **手动**：Actions → Deploy to Tencent Cloud (AIMarket) → Run workflow

## 监控

```bash
gh run list --workflow="deploy.yml" --limit 3
gh run watch {run-id}
gh run view {run-id} --log-failed
```

## 成功标准

Workflow 内 **Verify deployment** 通过：

- `http://{IP}:4100/health` → 200
- `http://{IP}:3100/` → 200

默认 IP 来自 Secret `TENCENT_CLOUD_IP`（如 `119.29.173.89`）。

## Secrets（Environment `production`）

- `TENCENT_CLOUD_IP` / `TENCENT_CLOUD_USER` / `TENCENT_CLOUD_SSH_KEY`
- `TCR_USERNAME` / `TCR_PASSWORD`（服务器从 TCR 拉镜像，必填）
- Variables（可选）：`TCR_REGISTRY`（默认 `ccr.ccs.tencentyun.com`）、`TCR_NAMESPACE`（默认 `aimarket`）
- **Self-hosted runner**（可选，`aimarket-build`，`deploy/bootstrap-github-runner.sh`；默认 `ubuntu-latest`）
- 勿使用 `TENCENT_CLOUD_PROJECT_DIR`（拼兔兔专用）

## 合并节奏

合并 main 后等待 Deploy 成功再合下一单；见 `docs/DEPLOY_MERGE_POLICY.md`。GHCR 备份：`ghcr-backup.yml`（手动）。

## 服务器路径

- 应用目录：`/opt/aimarket`
- 勿修改：`/opt/pintuotuo`

## 回滚

```bash
# 重跑上一次成功的 deploy run
gh run list --workflow=deploy.yml --status=success --limit 2
gh run rerun {previous-run-id}
```

或手动 SSH：`docker compose -f /opt/aimarket/deploy/docker-compose.prod.yml` 使用上一版镜像 tag。

详见 `docs/DEPLOY_CI.md`。
