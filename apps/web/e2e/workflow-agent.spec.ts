import { test, expect } from "@playwright/test";
import { registerViaEmail } from "./helpers/auth";
import { gotoStudioAndWait, studioWorkstation } from "./helpers/studio";

/**
 * NeoWOW 式 /workflow 入口 smoke：
 * - 左无限画布
 * - 右 Agent 对话面板（默认展开、可拖拽调宽）
 */

async function skipCoach(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem("aimarket_studio_coach_v2", "1");
    localStorage.setItem("aimarket_studio_mobile_coach_v1", "1");
    localStorage.setItem("aimarket_canvas_flow", "1");
  });
}

test.describe("Workflow Shell", () => {
  test.setTimeout(120_000);

  test("访问 /workflow 展示无限画布与 Agent 面板", async ({ page }) => {
    await skipCoach(page);
    await registerViaEmail(page, { emailPrefix: "workflow" });
    await gotoStudioAndWait(page, "/workflow");

    await expect(page.getByTestId("workflow-page")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("infinite-canvas-pane")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("workflow-agent-panel")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("workflow-agent-input")).toBeVisible();

    const resizeHandle = page.getByTestId("workflow-agent-resize-handle");
    await expect(resizeHandle).toBeVisible();

    const quickTags = page.getByTestId("workflow-agent-quick-tag");
    await expect(quickTags.first()).toBeVisible();
    expect(await quickTags.count()).toBeGreaterThanOrEqual(2);

    // workflow 壳不展示底部 Studio Dock
    await expect(studioWorkstation(page)).toBeHidden({ timeout: 5_000 });
  });
});
