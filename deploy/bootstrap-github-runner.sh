#!/usr/bin/env bash
# 在「同地域构建机」上安装 GitHub Actions self-hosted runner（标签 aimarket-build）。
# deploy.yml 的 build-push / deploy 均依赖此 runner，避免 GitHub 托管 runner 跨境推 TCR 耗时 30–90 分钟。
#
# 推荐：与生产分离的专用 CVM（4C8G+、50GB+ 盘）。资源紧张时可与生产同机（见 SAME_HOST_WARN）。
# 用法（root 或 sudo）:
#   export RUNNER_URL="https://github.com/sev7n4/aimarket"
#   export RUNNER_TOKEN="<从 GitHub Settings → Actions → Runners → New 获取的单次 token>"
#   export RUNNER_NAME="aimarket-build-1"
#   sudo -E bash deploy/bootstrap-github-runner.sh
set -euo pipefail

RUNNER_VERSION="${RUNNER_VERSION:-2.323.0}"
RUNNER_USER="${RUNNER_USER:-runner}"
RUNNER_HOME="${RUNNER_HOME:-/opt/actions-runner}"
BUILDX_CACHE_DIR="${BUILDX_CACHE_DIR:-/var/cache/buildx}"
RUNNER_URL="${RUNNER_URL:?set RUNNER_URL e.g. https://github.com/org/repo}"
RUNNER_TOKEN="${RUNNER_TOKEN:?set RUNNER_TOKEN from GitHub New self-hosted runner}"
RUNNER_NAME="${RUNNER_NAME:-aimarket-build-1}"
RUNNER_LABELS="${RUNNER_LABELS:-aimarket-build}"

if [[ -d /opt/aimarket ]] && [[ "${ALLOW_SAME_HOST_AS_PRODUCTION:-}" != "1" ]]; then
  echo "WARN: /opt/aimarket exists — production may share this host."
  echo "      Prefer a dedicated build CVM. To continue on this host: export ALLOW_SAME_HOST_AS_PRODUCTION=1"
  exit 1
fi
COLOCATED=0
[[ -d /opt/aimarket ]] && COLOCATED=1

echo "=== 依赖：Docker + Buildx ==="
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable docker 2>/dev/null || true
systemctl start docker 2>/dev/null || true
docker buildx version >/dev/null 2>&1 || docker buildx install 2>/dev/null || true

if ! id "$RUNNER_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$RUNNER_USER"
  usermod -aG docker "$RUNNER_USER"
fi

mkdir -p "$BUILDX_CACHE_DIR"
chown -R "$RUNNER_USER:$RUNNER_USER" "$BUILDX_CACHE_DIR"

mkdir -p "$RUNNER_HOME"
cd "$RUNNER_HOME"

if [[ ! -f ./config.sh ]]; then
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64) RUNNER_ARCH=x64 ;;
    aarch64|arm64) RUNNER_ARCH=arm64 ;;
    *) echo "Unsupported arch: $ARCH"; exit 1 ;;
  esac
  TARBALL="actions-runner-linux-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
  curl -fsSLO "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${TARBALL}"
  tar xzf "$TARBALL"
  rm -f "$TARBALL"
fi

chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_HOME"

sudo -u "$RUNNER_USER" ./config.sh \
  --url "$RUNNER_URL" \
  --token "$RUNNER_TOKEN" \
  --name "$RUNNER_NAME" \
  --labels "$RUNNER_LABELS" \
  --unattended \
  --replace

./svc.sh install "$RUNNER_USER"
./svc.sh start
./svc.sh status || true

# 同机 deploy 时 runner 需 sudo 执行 deploy-remote.sh（workflow: sudo -E + IMAGE_TAG 等环境变量）
AIMARKET_DEPLOY_DIR="${AIMARKET_DEPLOY_DIR:-/opt/aimarket/deploy}"
DEPLOY_REMOTE_SCRIPT="${AIMARKET_DEPLOY_DIR}/deploy-remote.sh"
if [[ -x "$DEPLOY_REMOTE_SCRIPT" ]]; then
  cat > /etc/sudoers.d/aimarket-runner-deploy <<EOF
runner ALL=(ALL) NOPASSWD:SETENV: ${DEPLOY_REMOTE_SCRIPT}
runner ALL=(ALL) NOPASSWD: /bin/cp
runner ALL=(ALL) NOPASSWD: /usr/bin/docker
runner ALL=(ALL) NOPASSWD: /usr/bin/sed
EOF
  chmod 440 /etc/sudoers.d/aimarket-runner-deploy
  echo "sudoers: ${DEPLOY_REMOTE_SCRIPT} (SETENV)"
fi

# 避免 runner 自动升级时从 GitHub 拉包失败（国内网络）
RUNNER_SERVICE="$(systemctl list-units --type=service --all 'actions.runner.*.service' --no-legend 2>/dev/null | awk '{print $1}' | head -1)"
if [[ -n "$RUNNER_SERVICE" ]]; then
  OVERRIDE_DIR="/etc/systemd/system/${RUNNER_SERVICE}.d"
  mkdir -p "$OVERRIDE_DIR"
  cat > "${OVERRIDE_DIR}/override.conf" <<'EOF'
[Service]
Environment=ACTIONS_RUNNER_DISABLE_AUTO_UPDATE=true
Restart=always
RestartSec=30
EOF
  systemctl daemon-reload
  systemctl restart "$RUNNER_SERVICE"
  echo "runner auto-update disabled: $RUNNER_SERVICE"
fi

PRUNE_SCRIPT="/usr/local/bin/aimarket-build-prune.sh"
if [[ -x "$AIMARKET_DEPLOY_DIR/prune-build-runner.sh" ]]; then
  ln -sf "$AIMARKET_DEPLOY_DIR/prune-build-runner.sh" "$PRUNE_SCRIPT"
else
  cat > "$PRUNE_SCRIPT" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
docker image prune -f >/dev/null 2>&1 || true
docker builder prune -f --filter "until=72h" >/dev/null 2>&1 || true
AVAIL_KB=$(df -Pk / | awk 'NR==2 {print $4}')
if [[ "${AVAIL_KB:-0}" -lt 2097152 ]]; then
  docker image prune -af >/dev/null 2>&1 || true
  docker builder prune -af --filter "until=24h" >/dev/null 2>&1 || true
fi
EOF
  chmod +x "$PRUNE_SCRIPT"
fi

CRON_LINE="0 3 * * * root $PRUNE_SCRIPT >> /var/log/aimarket-build-prune.log 2>&1"
echo "$CRON_LINE" > /etc/cron.d/aimarket-build-prune
chmod 644 /etc/cron.d/aimarket-build-prune
touch /var/log/aimarket-build-prune.log
chmod 644 /var/log/aimarket-build-prune.log

WATCHDOG_SCRIPT="${AIMARKET_DEPLOY_DIR}/ensure-runner-watchdog.sh"
if [[ -x "$WATCHDOG_SCRIPT" ]]; then
  WATCHDOG_CRON="*/5 * * * * root $WATCHDOG_SCRIPT >> /var/log/aimarket-runner-watchdog.log 2>&1"
  echo "$WATCHDOG_CRON" > /etc/cron.d/aimarket-runner-watchdog
  chmod 644 /etc/cron.d/aimarket-runner-watchdog
  touch /var/log/aimarket-runner-watchdog.log
  chmod 644 /var/log/aimarket-runner-watchdog.log
  echo "watchdog cron: /etc/cron.d/aimarket-runner-watchdog"
fi

echo ""
echo "完成。在 GitHub → Settings → Actions → Runners 应看到 Online，标签含: $RUNNER_LABELS"
echo "Buildx cache dir: $BUILDX_CACHE_DIR"
if [[ "$COLOCATED" -eq 1 ]]; then
  echo "（已与生产同机安装，注意 CPU/磁盘争用）"
fi
