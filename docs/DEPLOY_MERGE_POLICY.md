# main 合并与 Deploy 节奏

Deploy workflow（`.github/workflows/deploy.yml`）在每次 **push main**（非仅 docs）时自动运行。为减少无效构建与 TCR 推送浪费，团队约定如下。

## 保留 `cancel-in-progress: true`

当新的 main push 触发 Deploy 时，**正在进行的**上一次 Deploy 会被取消。

- **不要关闭**该选项，否则可能先部署旧 SHA，或与新一轮构建争抢资源。
- 被取消的 run 若已推部分层到 TCR，该次 push 作废，属于预期损耗。

## 合并节奏（#3）

1. **Squash 合并 PR 前**：CI + Integration + E2E 全绿（与分支保护一致）。
2. **合并后**：在 GitHub Actions 中确认 **Deploy to Tencent Cloud (AIMarket)** 对**本次 merge commit** 跑完并成功，再合并下一个会触发 deploy 的 PR。
3. **避免**在 10–15 分钟内连续多次 merge 到 main（除非接受上一单 Deploy 被取消）。
4. 紧急热修：可合并，但知悉上一单 deploy 可能被 cancel；必要时对**已上线 SHA** 用手动 `workflow_dispatch` 重部署。

## 如何判断「可以合下一单」

- 打开最新 main 上的 Deploy run → 状态 **Success**。
- 或 Run 列表中无 `in_progress` 的 `aimarket-deploy-production` 组任务。

## 与紧急回退

- 生产回滚：TCR 上保留历史 tag，在服务器执行 `deploy/deploy-remote.sh`（见 [DEPLOY_CI.md](./DEPLOY_CI.md)）。
- GHCR 备份：非自动；对需要备份的 `IMAGE_TAG` 运行 **Mirror TCR images to GHCR**（`ghcr-backup.yml`）。

## 构建耗时

默认在 GitHub 托管 runner 推 TCR，单次 Deploy 可能 30–90 分钟（以 API 镜像 push 为主）。合并间隔见上文，避免连续 merge 浪费已进行的 push。
