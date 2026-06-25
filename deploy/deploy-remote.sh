#!/usr/bin/env bash
# 在服务器 /opt/aimarket 执行：从腾讯云 TCR 拉取镜像并启动（与 GHA deploy 一致）
# 用法:
#   export IMAGE_TAG=<git-sha>
#   export TCR_REGISTRY=ccr.ccs.tencentyun.com
#   export TCR_NAMESPACE=aimarket
#   echo "$TCR_PASSWORD" | docker login "$TCR_REGISTRY" -u "$TCR_USERNAME" --password-stdin
#   bash deploy/deploy-remote.sh
set -euo pipefail

cd "$(dirname "$0")/.."
IMAGE_TAG="${IMAGE_TAG:?set IMAGE_TAG to git commit sha}"
TCR_REGISTRY="${TCR_REGISTRY:?set TCR_REGISTRY e.g. ccr.ccs.tencentyun.com}"
TCR_NAMESPACE="${TCR_NAMESPACE:?set TCR_NAMESPACE e.g. aimarket}"
IMAGE_REPO_PREFIX="${TCR_REGISTRY}/${TCR_NAMESPACE}"

COMPOSE="docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.prod.images.yml"

echo "=== Disk before pull (${IMAGE_REPO_PREFIX}) ==="
df -h / /var/lib/docker 2>/dev/null || df -h /
set +euo
docker image prune -f >/dev/null 2>&1
for REPO in "${IMAGE_REPO_PREFIX}/aimarket-api-v2" "${IMAGE_REPO_PREFIX}/aimarket-web"; do
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
  if TCR_REGISTRY="$TCR_REGISTRY" TCR_NAMESPACE="$TCR_NAMESPACE" IMAGE_TAG="$IMAGE_TAG" $COMPOSE pull; then
    break
  fi
  [[ "$i" -eq 5 ]] && { echo "pull failed"; exit 1; }
  sleep $((i * 20))
done

TCR_REGISTRY="$TCR_REGISTRY" TCR_NAMESPACE="$TCR_NAMESPACE" IMAGE_TAG="$IMAGE_TAG" $COMPOSE up -d --no-build

set +euo
docker image prune -f >/dev/null 2>&1
for REPO in "${IMAGE_REPO_PREFIX}/aimarket-api-v2" "${IMAGE_REPO_PREFIX}/aimarket-web"; do
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
echo "部署完成 (IMAGE_TAG=$IMAGE_TAG, registry=$IMAGE_REPO_PREFIX)"
