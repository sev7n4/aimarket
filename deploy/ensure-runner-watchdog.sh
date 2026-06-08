#!/usr/bin/env bash
# 构建机 cron：runner 离线或 Docker 异常时自动重启（同机 deploy 场景）
# 用法: sudo bash deploy/ensure-runner-watchdog.sh
# cron: */5 * * * * root /opt/aimarket/deploy/ensure-runner-watchdog.sh >> /var/log/aimarket-runner-watchdog.log 2>&1
set -euo pipefail

RUNNER_HOME="${RUNNER_HOME:-/opt/actions-runner}"
REPO="${GITHUB_REPOSITORY:-sev7n4/aimarket}"
RUNNER_LABEL="${RUNNER_LABEL:-aimarket-build}"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

if ! command -v docker >/dev/null; then
  log "WARN: docker missing"
  exit 0
fi

if ! docker info >/dev/null 2>&1; then
  log "WARN: docker not responding — restarting docker"
  systemctl restart docker || true
  sleep 10
fi

RUNNER_SERVICE="$(systemctl list-units --type=service --all 'actions.runner.*.service' --no-legend 2>/dev/null | awk '{print $1}' | head -1)"
if [[ -z "$RUNNER_SERVICE" ]]; then
  log "WARN: no actions.runner systemd unit"
  exit 0
fi

if ! systemctl is-active --quiet "$RUNNER_SERVICE"; then
  log "WARN: $RUNNER_SERVICE inactive — restarting"
  systemctl restart "$RUNNER_SERVICE"
  exit 0
fi

if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  online="$(gh api "repos/${REPO}/actions/runners" --jq ".runners[] | select(.status==\"online\") | select([.labels[].name] | index(\"${RUNNER_LABEL}\")) | .name" 2>/dev/null | head -1 || true)"
  if [[ -z "$online" ]]; then
    log "WARN: no online runner with label ${RUNNER_LABEL} — restarting $RUNNER_SERVICE"
    systemctl restart "$RUNNER_SERVICE"
  fi
fi
