#!/usr/bin/env bash
# 在国内 CVM 一次性初始化 /opt/aimarket（不修改 /opt/pintuotuo）
set -euo pipefail

AIMARKET_DIR="${AIMARKET_DIR:-/opt/aimarket}"
REPO_URL="${REPO_URL:-https://github.com/sev7n4/aimarket.git}"
BRANCH="${BRANCH:-main}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 root 或 sudo 执行"
  exit 1
fi

command -v docker >/dev/null || { echo "请先安装 Docker"; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "请先安装 Docker Compose 插件"; exit 1; }

mkdir -p "$AIMARKET_DIR"
if [[ ! -d "$AIMARKET_DIR/.git" ]]; then
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$AIMARKET_DIR"
else
  echo "已存在 git 仓库: $AIMARKET_DIR"
fi

cd "$AIMARKET_DIR"
if [[ ! -f .env ]]; then
  cp deploy/.env.production.example .env
  JWT=$(openssl rand -hex 24)
  ADM=$(openssl rand -hex 16)
  sed -i "s/请替换为随机长字符串/$JWT/" .env
  sed -i "s/请替换为随机管理密钥/$ADM/" .env
  echo "已生成 .env（请核对 NEXT_PUBLIC_API_URL / CORS_ORIGIN）"
else
  echo "保留已有 .env"
fi

echo "完成。部署: bash deploy/deploy-remote.sh"
