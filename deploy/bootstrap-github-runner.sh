#!/usr/bin/env bash
# 在「专用构建机」上安装 GitHub Actions self-hosted runner（标签 aimarket-build）
# 勿与生产 /opt/aimarket 同机混跑，除非资源充足且接受安全边界重叠。
#
# 用法（root 或 sudo）:
#   export RUNNER_URL="https://github.com/sev7n4/aimarket"
#   export RUNNER_TOKEN="<从 GitHub Settings → Actions → Runners → New 获取的单次 token>"
#   export RUNNER_NAME="aimarket-build-1"
#   sudo -E bash deploy/bootstrap-github-runner.sh
set -euo pipefail

RUNNER_VERSION="${RUNNER_VERSION:-2.323.0}"
RUNNER_USER="${RUNNER_USER:-runner}"
RUNNER_HOME="${RUNNER_HOME:-/opt/actions-runner}"
RUNNER_URL="${RUNNER_URL:?set RUNNER_URL e.g. https://github.com/org/repo}"
RUNNER_TOKEN="${RUNNER_TOKEN:?set RUNNER_TOKEN from GitHub New self-hosted runner}"
RUNNER_NAME="${RUNNER_NAME:-aimarket-build-1}"
RUNNER_LABELS="${RUNNER_LABELS:-aimarket-build}"

echo "=== 依赖：Docker ==="
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable docker 2>/dev/null || true
systemctl start docker 2>/dev/null || true

if ! id "$RUNNER_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$RUNNER_USER"
  usermod -aG docker "$RUNNER_USER"
fi

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

echo ""
echo "完成。在 GitHub → Settings → Actions → Runners 应看到 Online，标签含: $RUNNER_LABELS"
echo "Deploy workflow build-push 使用: runs-on: [self-hosted, aimarket-build]"
