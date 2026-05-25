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

for i in 1 2 3 4 5; do
  if IMAGE_TAG="$IMAGE_TAG" $COMPOSE pull; then
    break
  fi
  [[ "$i" -eq 5 ]] && { echo "pull failed"; exit 1; }
  sleep $((i * 20))
done

IMAGE_TAG="$IMAGE_TAG" $COMPOSE up -d --no-build

docker image prune -f >/dev/null || true
for REPO in "ghcr.io/${GHCR_OWNER}/aimarket-api" "ghcr.io/${GHCR_OWNER}/aimarket-web"; do
  docker images "$REPO" --format '{{.Tag}}' 2>/dev/null | while read -r tag; do
    [[ -z "$tag" || "$tag" == "<none>" ]] && continue
    [[ "$tag" == "$IMAGE_TAG" || "$tag" == "latest" ]] && continue
    docker rmi "${REPO}:${tag}" 2>/dev/null || true
  done
done

echo "等待健康检查..."
sleep 8
curl -fsS "http://127.0.0.1:4100/health" | head -c 200
echo ""
curl -fsS -o /dev/null -w "Web :3100 -> %{http_code}\n" "http://127.0.0.1:3100/"
echo "部署完成 (IMAGE_TAG=$IMAGE_TAG)"
