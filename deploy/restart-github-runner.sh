#!/usr/bin/env bash
# 在构建机上重启 GitHub Actions self-hosted runner（标签 aimarket-build）。
# 用法（root）: sudo bash deploy/restart-github-runner.sh
set -euo pipefail

RUNNER_HOME="${RUNNER_HOME:-/opt/actions-runner}"

if [[ ! -d "$RUNNER_HOME" ]]; then
  echo "ERROR: $RUNNER_HOME 不存在，请先运行 deploy/bootstrap-github-runner.sh"
  exit 1
fi

cd "$RUNNER_HOME"

RUNNER_SERVICE="$(systemctl list-units --type=service --all 'actions.runner.*.service' --no-legend 2>/dev/null | awk '{print $1}' | head -1)"

if [[ -n "$RUNNER_SERVICE" ]]; then
  echo "=== 重启 systemd 服务: $RUNNER_SERVICE ==="
  systemctl restart "$RUNNER_SERVICE"
  systemctl --no-pager status "$RUNNER_SERVICE" || true
else
  echo "=== 未找到 actions.runner systemd 单元，尝试 svc.sh ==="
  if [[ -x ./svc.sh ]]; then
    ./svc.sh stop || true
    ./svc.sh start
    ./svc.sh status || true
  else
    echo "ERROR: 找不到 svc.sh，请重新执行 bootstrap-github-runner.sh"
    exit 1
  fi
fi

echo ""
echo "请在 GitHub → Settings → Actions → Runners 确认 aimarket-build-1 为 Online"
echo "然后手动触发 Deploy: Actions → Deploy to Tencent Cloud (AIMarket) → Run workflow"
