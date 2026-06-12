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
USE_PCT=$(df -Pk / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
# 构建机 40G 盘：可用 <8GB 或使用率 >75% 时激进清理（避免 Next 构建 ENOSPC / runner 掉线）
if [[ "${AVAIL_KB:-0}" -lt 8388608 || "${USE_PCT:-0}" -gt 75 ]]; then
  echo "WARN: disk avail=$((AVAIL_KB / 1024 / 1024))GB use=${USE_PCT}% — aggressive prune"
  docker builder prune -af --filter "until=24h" >/dev/null 2>&1 || true
  docker image prune -af >/dev/null 2>&1 || true
fi
set -eu
set -o pipefail

echo "=== after prune ==="
df -h / 2>/dev/null || true
docker system df 2>/dev/null || true
