#!/usr/bin/env bash
# 在服务器 /opt/aimarket 目录执行：拉代码、构建、启动
set -euo pipefail

cd "$(dirname "$0")/.."
git fetch origin
git reset --hard "${DEPLOY_REF:-origin/main}"

docker compose -f deploy/docker-compose.prod.yml build --pull
docker compose -f deploy/docker-compose.prod.yml up -d

echo "等待健康检查..."
sleep 8
curl -fsS "http://127.0.0.1:4100/health" | head -c 200
echo ""
curl -fsS -o /dev/null -w "Web :3100 -> %{http_code}\n" "http://127.0.0.1:3100/"
echo "部署完成"
