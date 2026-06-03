#!/usr/bin/env bash
# 在服务器 /opt/aimarket 执行：从 GHCR 拉取镜像并启动（与 GHA deploy 一致）
# 用法:
#   export IMAGE_TAG=<git-sha>
#   export GHCR_OWNER=sev7n4
#   echo "$GITHUB_TOKEN" | docker login ghcr.io -u USER --password-stdin
#   bash deploy/deploy-remote.sh
set -euo pipefail

cd "$(dirname "$0")/.."
IMAGE_TAG="${IMAGE_TAG:?set IMAGE_TAG to git commit sha}"
GHCR_OWNER="${GHCR_OWNER:-sev7n4}"

COMPOSE="docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.prod.images.yml"

echo "=== Disk before pull ==="
df -h / /var/lib/docker 2>/dev/null || df -h /
set +euo
docker image prune -f >/dev/null 2>&1
for REPO in "ghcr.io/${GHCR_OWNER}/aimarket-api" "ghcr.io/${GHCR_OWNER}/aimarket-web"; do
  docker images "$REPO" --format '{{.Tag}}' 2>/dev/null | while read -r tag; do
    [[ -z "$tag" || "$tag" == "<none>" ]] && continue
    [[ "$tag" == "$IMAGE_TAG" || "$tag" == "latest" ]] && continue
    docker rmi "${REPO}:${tag}" 2>/dev/null || true
  done || true
done
docker builder prune -af --filter "until=48h" 2>/dev/null || true
AVAIL_KB=$(df -Pk / | awk 'NR==2 {print $4}')
if [[ "${AVAIL_KB:-0}" -lt 2097152 ]]; then
  echo "WARN: disk < 2GB, pruning all unused images"
  docker image prune -af >/dev/null 2>&1
fi
set -euo pipefail

for i in 1 2 3 4 5; do
  if IMAGE_TAG="$IMAGE_TAG" $COMPOSE pull; then
    break
  fi
  [[ "$i" -eq 5 ]] && { echo "pull failed"; exit 1; }
  sleep $((i * 20))
done

IMAGE_TAG="$IMAGE_TAG" $COMPOSE up -d --no-build

set +euo
docker image prune -f >/dev/null 2>&1
for REPO in "ghcr.io/${GHCR_OWNER}/aimarket-api" "ghcr.io/${GHCR_OWNER}/aimarket-web"; do
  docker images "$REPO" --format '{{.Tag}}' 2>/dev/null | while read -r tag; do
    [[ -z "$tag" || "$tag" == "<none>" ]] && continue
    [[ "$tag" == "$IMAGE_TAG" || "$tag" == "latest" ]] && continue
    docker rmi "${REPO}:${tag}" 2>/dev/null || true
  done || true
done
set -euo pipefail

echo "等待健康检查..."
sleep 8
curl -fsS "http://127.0.0.1:4100/health" | head -c 200
echo ""
curl -fsS -o /dev/null -w "Web :3100 -> %{http_code}\n" "http://127.0.0.1:3100/"
echo "部署完成 (IMAGE_TAG=$IMAGE_TAG)"
