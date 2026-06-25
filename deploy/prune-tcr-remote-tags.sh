#!/usr/bin/env bash
# 清理 TCR 个人版远程 tag（保留最近 KEEP_COUNT 个 sha tag + latest + buildcache）
# 用法（GHA / 构建机）:
#   TCR_USERNAME=... TCR_PASSWORD=... KEEP_COUNT=20 bash deploy/prune-tcr-remote-tags.sh
set -euo pipefail

TCR_REGISTRY="${TCR_REGISTRY:-ccr.ccs.tencentyun.com}"
TCR_NAMESPACE="${TCR_NAMESPACE:-aimarket}"
KEEP_COUNT="${KEEP_COUNT:-20}"
TCR_USERNAME="${TCR_USERNAME:?set TCR_USERNAME}"
TCR_PASSWORD="${TCR_PASSWORD:?set TCR_PASSWORD}"

REPOS=(aimarket-api aimarket-web)
AUTH_B64=$(printf '%s:%s' "$TCR_USERNAME" "$TCR_PASSWORD" | base64 | tr -d '\n')

fetch_token() {
  local repo="$1"
  curl -fsS "https://${TCR_REGISTRY}/v2/token?service=${TCR_REGISTRY}&scope=repository:${TCR_NAMESPACE}/${repo}:pull&scope=repository:${TCR_NAMESPACE}/${repo}:delete" \
    -H "Authorization: Basic ${AUTH_B64}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])'
}

list_tags() {
  local repo="$1" token="$2"
  curl -fsS "https://${TCR_REGISTRY}/v2/${TCR_NAMESPACE}/${repo}/tags/list" \
    -H "Authorization: Bearer ${token}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("\n".join(d.get("tags") or []))'
}

delete_tag() {
  local repo="$1" tag="$2" token="$3"
  local digest
  digest=$(curl -fsSI \
    -H "Authorization: Bearer ${token}" \
    -H "Accept: application/vnd.docker.distribution.manifest.v2+json" \
    "https://${TCR_REGISTRY}/v2/${TCR_NAMESPACE}/${repo}/manifests/${tag}" \
    | awk -F': ' 'tolower($1)=="docker-content-digest" {print $2}' | tr -d '\r')
  if [[ -z "$digest" ]]; then
    echo "WARN: no digest for ${repo}:${tag}, skip"
    return 0
  fi
  curl -fsS -X DELETE \
    -H "Authorization: Bearer ${token}" \
    "https://${TCR_REGISTRY}/v2/${TCR_NAMESPACE}/${repo}/manifests/${digest}" >/dev/null
  echo "deleted ${repo}:${tag}"
}

for REPO in "${REPOS[@]}"; do
  echo "=== ${TCR_NAMESPACE}/${REPO} ==="
  TOKEN=$(fetch_token "$REPO")
  mapfile -t ALL_TAGS < <(list_tags "$REPO" "$TOKEN" | sort -u)
  echo "total tags: ${#ALL_TAGS[@]}"

  KEEP_SET=("latest" "buildcache")
  mapfile -t SHA_TAGS < <(printf '%s\n' "${ALL_TAGS[@]}" | grep -E '^[0-9a-f]{40}$' | sort -r)
  for ((i = 0; i < KEEP_COUNT && i < ${#SHA_TAGS[@]}; i++)); do
    KEEP_SET+=("${SHA_TAGS[$i]}")
  done

  deleted=0
  for TAG in "${ALL_TAGS[@]}"; do
    [[ -z "$TAG" ]] && continue
    keep=0
    for K in "${KEEP_SET[@]}"; do
      if [[ "$TAG" == "$K" ]]; then keep=1; break; fi
    done
    if [[ "$keep" == 1 ]]; then continue; fi
    delete_tag "$REPO" "$TAG" "$TOKEN" || echo "WARN: failed ${REPO}:${TAG}"
    deleted=$((deleted + 1))
    sleep 0.15
  done
  echo "pruned ${deleted} tag(s) from ${REPO}"
done

echo "=== prune complete ==="
