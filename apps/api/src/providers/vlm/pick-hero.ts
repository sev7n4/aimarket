import { db } from "../../db/index.js";
import { isAgentVlmEnabled } from "./registry.js";
import type { VlmQualityInput } from "./types.js";
import { vlmMockProvider } from "./mock.js";
import { vlmQwenProvider } from "./qwen-vl.js";

export interface PickHeroInput {
  prompt: string;
  jobId: string;
  urls: string[];
}

function resolveVlmProvider() {
  const mode = (process.env.AGENT_VLM_PROVIDER ?? "auto").toLowerCase();
  if (mode === "mock") return vlmMockProvider;
  if (mode === "qwen") return vlmQwenProvider;
  if (vlmQwenProvider.supports()) return vlmQwenProvider;
  return vlmMockProvider;
}

/** 套图完成后选主图索引，供抠图/视频步骤引用 */
export async function pickSkillHeroIndex(input: PickHeroInput): Promise<number> {
  if (!isAgentVlmEnabled() || input.urls.length <= 1) {
    return 0;
  }

  const labeled = db
    .prepare(
      `SELECT label, sort_order FROM job_outputs WHERE job_id = ? ORDER BY sort_order ASC`,
    )
    .all(input.jobId) as Array<{ label: string | null; sort_order: number }>;

  const mainByLabel = labeled.findIndex((r) =>
    (r.label ?? "").includes("主图"),
  );
  if (mainByLabel >= 0 && mainByLabel < input.urls.length) {
    return mainByLabel;
  }

  const provider = resolveVlmProvider();
  const slideHint = labeled
    .map((r, i) => `${i}:${r.label ?? `图${i + 1}`}`)
    .join("；");

  const vlmInput: VlmQualityInput = {
    prompt: `${input.prompt}\n【套图候选】${slideHint}\n请选出最适合做主图抠底的一张（返回 heroIndex 0-${input.urls.length - 1}）`,
    urls: input.urls,
    mode: "ecommerce",
  };

  try {
    const result = await provider.checkQuality(vlmInput);
    const idx = result.heroIndex;
    if (Number.isInteger(idx) && idx >= 0 && idx < input.urls.length) {
      return idx;
    }
  } catch (err) {
    console.warn("[vlm] pickSkillHero failed, use index 0:", err);
  }

  return 0;
}
