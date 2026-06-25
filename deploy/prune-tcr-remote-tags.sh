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

REPOS=(aimarket-api-v2 aimarket-web)
AUTH_B64=$(printf '%s:%s' "$TCR_USERNAME" "$TCR_PASSWORD" | base64 | tr -d '\n')

auth_header() {
  printf 'Authorization: Basic %s' "$AUTH_B64"
}

fetch_bearer() {
  local repo="$1"
  local scope="repository:${TCR_NAMESPACE}/${repo}:pull,repository:${TCR_NAMESPACE}/${repo}:delete"
  local token_url="https://${TCR_REGISTRY}/service/token?service=token-service&scope=${scope}"
  local body
  body=$(curl -fsS "$token_url" -H "$(auth_header)" 2>/dev/null || true)
  if [[ -n "$body" ]]; then
    local token
    token=$(printf '%s' "$body" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("token") or d.get("access_token") or "")' 2>/dev/null || true)
    if [[ -n "$token" ]]; then
      printf 'Bearer %s' "$token"
      return 0
    fi
  fi
  auth_header
}

list_tags() {
  local repo="$1" auth="$2"
  curl -fsS "https://${TCR_REGISTRY}/v2/${TCR_NAMESPACE}/${repo}/tags/list" \
    -H "$auth" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("\n".join(d.get("tags") or []))'
}

delete_tag() {
  local repo="$1" tag="$2" auth="$3"
  local digest
  digest=$(curl -sS -D - -o /dev/null \
    -H "$auth" \
    -H "Accept: application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.docker.distribution.manifest.v2+json" \
    "https://${TCR_REGISTRY}/v2/${TCR_NAMESPACE}/${repo}/manifests/${tag}" \
    | awk -F': ' 'tolower($1)=="docker-content-digest" {print $2}' | tr -d '\r')
  if [[ -z "$digest" ]]; then
    echo "WARN: no digest for ${repo}:${tag}, skip"
    return 0
  fi
  curl -fsS -X DELETE \
    -H "$auth" \
    "https://${TCR_REGISTRY}/v2/${TCR_NAMESPACE}/${repo}/manifests/${digest}" >/dev/null
  echo "deleted ${repo}:${tag}"
}

for REPO in "${REPOS[@]}"; do
  echo "=== ${TCR_NAMESPACE}/${REPO} ==="
  AUTH=$(fetch_bearer "$REPO")
  mapfile -t ALL_TAGS < <(list_tags "$REPO" "$AUTH" | sort -u)
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
    delete_tag "$REPO" "$TAG" "$AUTH" || echo "WARN: failed ${REPO}:${TAG}"
    deleted=$((deleted + 1))
    sleep 0.15
  done
  echo "pruned ${deleted} tag(s) from ${REPO}"
done

echo "=== prune complete ==="
