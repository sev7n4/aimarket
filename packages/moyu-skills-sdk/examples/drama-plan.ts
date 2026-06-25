/**
 * 示例 1：完整的 Drama Plan + Produce 流程（同步阻塞版）。
 *
 * 运行：
 *   pnpm --filter @moyupi/skills exec tsx examples/drama-plan.ts
 *
 * 环境变量：
 *   MOYU_API_KEY  - 必填，moyu_sk_ 前缀
 *   MOYU_BASE_URL - 可选，默认 http://localhost:4100
 */
import { MoyuClient, MoyuError } from "../src/index.js";

async function main() {
  const apiKey = process.env.MOYU_API_KEY;
  if (!apiKey) {
    console.error("缺少 MOYU_API_KEY 环境变量");
    process.exit(1);
  }
  const baseUrl = process.env.MOYU_BASE_URL ?? "http://localhost:4100";

  const client = new MoyuClient({ apiKey, baseUrl });

  // 1. 健康检查
  const health = await client.health();
  console.log("✓ health:", health.service, health.version);

  // 2. 创建会话
  const session = await client.createSession({
    title: "SDK 示例 - 咖啡师与诗人",
    mode: "production",
    kind: "canvas",
  });
  console.log("✓ session:", session.id);

  // 3. 启动 Plan
  const plan = await client.startDramaPlan({
    sessionId: session.id,
    userIdea:
      "深夜咖啡馆里，一位失意的诗人遇见了总是记得每位客人故事的咖啡师。两人因一杯拿铁展开一段关于创作与回忆的对话，最终诗人找回灵感。",
    targetDurationSec: 90,
    aspectRatio: "9:16",
    projectType: "short_drama",
    autoProduce: false,
  });
  console.log("✓ plan:", plan.id, "status:", plan.status);
  console.log("  projectId:", plan.projectId ?? "(尚未生成)");

  // 4. 轮询等待会话进入终态（生产建议用 webhook）
  console.log("⏳ 等待 Plan 完成（最长 5 分钟）…");
  try {
    const finalStatus = await client.waitDramaSession(session.id, {
      timeoutMs: 5 * 60 * 1000,
      pollIntervalMs: 5_000,
      onProgress: (s) => console.log(`  status: ${s}`),
    });
    console.log("✓ 最终状态:", finalStatus);
  } catch (err) {
    if (err instanceof MoyuError) {
      console.error("✗ 轮询失败:", err.code, err.message);
    } else {
      throw err;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
