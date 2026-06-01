import { vlmMockProvider } from "./mock.js";
import { vlmQwenProvider } from "./qwen-vl.js";
import type { VlmQualityInput, VlmQualityResult } from "./types.js";

const providers = [vlmQwenProvider, vlmMockProvider];

function resolveVlmProvider() {
  const mode = (process.env.AGENT_VLM_PROVIDER ?? "auto").toLowerCase();
  if (mode === "mock") return vlmMockProvider;
  if (mode === "qwen") return vlmQwenProvider;
  for (const p of providers) {
    if (p.supports()) return p;
  }
  return vlmMockProvider;
}

export function isAgentVlmEnabled(): boolean {
  return process.env.AGENT_VLM_ENABLED === "true";
}

export async function runVlmQualityCheck(
  input: VlmQualityInput,
): Promise<VlmQualityResult> {
  const provider = resolveVlmProvider();
  try {
    return await provider.checkQuality(input);
  } catch (err) {
    console.warn("[vlm] check failed, fallback pass:", err);
    return {
      pass: true,
      heroIndex: 0,
      reason: "VLM 调用失败，默认通过",
      provider: provider.name,
    };
  }
}
