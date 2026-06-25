/**
 * 示例 2：对已存在的 project 启动 Produce（视频生成）。
 *
 * 运行：
 *   pnpm --filter @moyupi/skills exec tsx examples/drama-produce.ts
 *
 * 环境变量：
 *   MOYU_API_KEY  - 必填
 *   MOYU_BASE_URL - 可选
 *   PROJECT_ID    - 必填，已存在的短剧项目 ID
 *   SESSION_ID    - 必填，与 PROJECT_ID 关联的会话 ID
 */
import { MoyuClient } from "../src/index.js";

async function main() {
  const apiKey = process.env.MOYU_API_KEY;
  const projectId = process.env.PROJECT_ID;
  const sessionId = process.env.SESSION_ID;
  if (!apiKey || !projectId || !sessionId) {
    console.error("缺少环境变量：MOYU_API_KEY / PROJECT_ID / SESSION_ID");
    process.exit(1);
  }
  const baseUrl = process.env.MOYU_BASE_URL ?? "http://localhost:4100";

  const client = new MoyuClient({ apiKey, baseUrl });

  // 启动 Produce
  const run = await client.startDramaProduce({
    sessionId,
    projectId,
    confirmed: true,
  });
  console.log("✓ produce run:", run.id);
  console.log("  status:", run.status);
  console.log("  estimatedPoints:", run.estimatedPoints ?? "—");

  // 等待会话终态
  console.log("⏳ 等待 Produce 完成…");
  const finalStatus = await client.waitDramaSession(sessionId, {
    timeoutMs: 30 * 60 * 1000,
    pollIntervalMs: 10_000,
    onProgress: (s) => {
      if (s !== "completed" && s !== "failed") {
        console.log(`  ${new Date().toISOString()} status: ${s}`);
      }
    },
  });

  console.log("✓ 最终状态:", finalStatus);
  if (finalStatus === "completed") {
    console.log("🎉 Produce 完成，可在 moyupi 控制台查看最终视频");
  } else {
    console.error("✗ Produce 未完成:", finalStatus);
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
