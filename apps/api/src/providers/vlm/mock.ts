import type { VlmProvider, VlmQualityInput, VlmQualityResult } from "./types.js";

let failOnceConsumed = false;

export function resetVlmMockForTests() {
  failOnceConsumed = false;
}

export const vlmMockProvider: VlmProvider = {
  name: "vlm-mock",
  supports: () => true,
  async checkQuality(input: VlmQualityInput): Promise<VlmQualityResult> {
    if (
      process.env.AGENT_VLM_MOCK_FAIL_ONCE === "true" &&
      !failOnceConsumed &&
      input.urls.length > 0
    ) {
      failOnceConsumed = true;
      return {
        pass: false,
        heroIndex: 0,
        reason: "mock：质检未通过（首次）",
        provider: "vlm-mock",
      };
    }
    return {
      pass: true,
      heroIndex: 0,
      reason: "mock：质检通过",
      provider: "vlm-mock",
    };
  },
};
