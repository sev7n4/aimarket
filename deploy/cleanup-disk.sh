#!/usr/bin/env bash
# 在 CVM 上释放 Docker 占用的磁盘（部署 pull 失败 / no space left on device 时执行）
# 用法: sudo bash deploy/cleanup-disk.sh
# 可选: KEEP_TAG=<git-sha> TCR_REGISTRY=ccr.ccs.tencentyun.com TCR_NAMESPACE=aimarket bash deploy/cleanup-disk.sh
set -euo pipefail

TCR_REGISTRY="${TCR_REGISTRY:-ccr.ccs.tencentyun.com}"
TCR_NAMESPACE="${TCR_NAMESPACE:-aimarket}"
IMAGE_REPO_PREFIX="${TCR_REGISTRY}/${TCR_NAMESPACE}"
KEEP_TAG="${KEEP_TAG:-}"

echo "=== 磁盘使用（清理前）==="
df -h / /var/lib/docker 2>/dev/null || df -h /
echo ""
docker system df 2>/dev/null || true
echo ""

set +euo

echo ">>> 清理悬空镜像与构建缓存..."
docker image prune -f >/dev/null 2>&1
docker builder prune -af --filter "until=48h" 2>/dev/null || true

echo ">>> 删除 AIMarket 旧 TCR 本地 tag（保留 KEEP_TAG / latest）..."
for REPO in "${IMAGE_REPO_PREFIX}/aimarket-api" "${IMAGE_REPO_PREFIX}/aimarket-web"; do
  docker images "$REPO" --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | while read -r img; do
    [[ -z "$img" ]] && continue
    tag="${img##*:}"
    [[ "$tag" == "<none>" ]] && continue
    if [[ -n "$KEEP_TAG" && ( "$tag" == "$KEEP_TAG" || "$tag" == "latest" ) ]]; then
      continue
    fi
    docker rmi "$img" 2>/dev/null || true
  done || true
done

for LEGACY in aimarket-api:release aimarket-web:release aimarket-api:local aimarket-web:local; do
  docker rmi "$LEGACY" 2>/dev/null || true
done

# 可选：清理历史 GHCR 本地缓存（迁移 TCR 后）
for REPO in "ghcr.io/sev7n4/aimarket-api" "ghcr.io/sev7n4/aimarket-web"; do
  docker images "$REPO" --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | while read -r img; do
    [[ -z "$img" ]] && continue
    docker rmi "$img" 2>/dev/null || true
  done || true
done

AVAIL_KB=$(df -Pk / | awk 'NR==2 {print $4}')
if [[ "${AVAIL_KB:-0}" -lt 2097152 ]]; then
  echo ">>> 可用空间 < 2GB，删除所有未使用镜像（不删正在运行的容器所用镜像）..."
  docker image prune -af >/dev/null 2>&1
fi

set -euo pipefail

echo ""
echo "=== 磁盘使用（清理后）==="
df -h / /var/lib/docker 2>/dev/null || df -h /
docker system df 2>/dev/null || true
echo ""
echo "完成。可重新部署:"
echo "  cd /opt/aimarket && IMAGE_TAG=<sha> TCR_REGISTRY=${TCR_REGISTRY} TCR_NAMESPACE=${TCR_NAMESPACE} bash deploy/deploy-remote.sh"
