#!/usr/bin/env bash
# 构建机 / 同机 runner 磁盘维护（cron 每日 03:00，可手动执行）
set -euo pipefail

TCR_REGISTRY="${TCR_REGISTRY:-ccr.ccs.tencentyun.com}"
TCR_NAMESPACE="${TCR_NAMESPACE:-aimarket}"
IMAGE_REPO_PREFIX="${TCR_REGISTRY}/${TCR_NAMESPACE}"

echo "=== prune-build-runner $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
df -h / 2>/dev/null || true
docker system df 2>/dev/null || true

set +eu
set +o pipefail
docker image prune -f >/dev/null 2>&1 || true
docker builder prune -f --filter "until=72h" >/dev/null 2>&1 || true

for REPO in "${IMAGE_REPO_PREFIX}/aimarket-api" "${IMAGE_REPO_PREFIX}/aimarket-web"; do
  docker images "$REPO" --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | while read -r img; do
    [[ -z "$img" ]] && continue
    tag="${img##*:}"
    [[ "$tag" == "<none>" || "$tag" == "latest" ]] && continue
    docker rmi "$img" 2>/dev/null || true
  done || true
done

for LEGACY in aimarket-api:release aimarket-web:release aimarket-api:local aimarket-web:local; do
  docker rmi "$LEGACY" 2>/dev/null || true
done

for REPO in "${IMAGE_REPO_PREFIX}/aimarket-api" "${IMAGE_REPO_PREFIX}/aimarket-web"; do
  docker rmi "${REPO}:buildcache" 2>/dev/null || true
done

AVAIL_KB=$(df -Pk / | awk 'NR==2 {print $4}')
if [[ "${AVAIL_KB:-0}" -lt 2097152 ]]; then
  echo "WARN: disk < 2GB — prune all unused images"
  docker image prune -af >/dev/null 2>&1 || true
  docker builder prune -af --filter "until=24h" >/dev/null 2>&1 || true
fi
set -eu
set -o pipefail

echo "=== after prune ==="
df -h / 2>/dev/null || true
docker system df 2>/dev/null || true
