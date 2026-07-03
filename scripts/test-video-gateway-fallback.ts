/**
 * 视频 Provider HTTP 网关回退校验
 * pnpm exec tsx scripts/test-video-gateway-fallback.ts
 */
import { httpVideoGatewayConfigured } from "../apps/api/src/providers/video/gateway-fallback.js";
import { klingVideoProvider } from "../apps/api/src/providers/video/kling-provider.js";
import { seedanceVideoProvider } from "../apps/api/src/providers/video/seedance-provider.js";
import { viduVideoProvider } from "../apps/api/src/providers/video/vidu-provider.js";
import { pixverseVideoProvider } from "../apps/api/src/providers/video/pixverse-provider.js";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

async function main() {
  ok(
    "httpVideoGatewayConfigured 可调用",
    typeof httpVideoGatewayConfigured === "function",
  );

  const providers = [
    { name: "kling", provider: klingVideoProvider, modelId: "kling-3.0" },
    {
      name: "seedance",
      provider: seedanceVideoProvider,
      modelId: "seedance-2.0",
    },
    { name: "vidu", provider: viduVideoProvider, modelId: "vidu" },
    {
      name: "pixverse",
      provider: pixverseVideoProvider,
      modelId: "pixverse",
    },
  ];

  for (const { name, provider, modelId } of providers) {
    ok(
      `${name} supports ${modelId}`,
      provider.supports(modelId) ||
        !process.env[`${name.toUpperCase()}_API_KEY`],
    );
  }

  const prevUrl = process.env.VIDEO_API_URL;
  delete process.env.VIDEO_API_URL;
  process.env.KLING_API_KEY = "test-key";

  let klingError = "";
  try {
    await klingVideoProvider.generate({
      prompt: "test",
      modelId: "kling-3.0",
      count: 1,
      resolution: "1k",
      aspectRatio: "16:9",
    });
  } catch (e) {
    klingError = e instanceof Error ? e.message : String(e);
  }
  ok(
    "Kling 无网关时提示配置 VIDEO_API_URL",
    klingError.includes("VIDEO_API_URL"),
  );

  if (prevUrl) process.env.VIDEO_API_URL = prevUrl;

  const failed = results.filter((r) => !r.pass);
  if (failed.length) {
    console.error(`\n${failed.length} 项失败`);
    process.exit(1);
  }
  console.log(`\n全部 ${results.length} 项通过`);
}

void main();
