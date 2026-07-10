import { test, expect } from "@playwright/test";
import { registerViaEmail } from "./helpers/auth";
import { gotoWorkflowAndWait, studioWorkstation } from "./helpers/studio";

async function skipCoach(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem("aimarket_studio_coach_v2", "1");
    localStorage.setItem("aimarket_studio_mobile_coach_v1", "1");
    localStorage.setItem("aimarket_canvas_flow", "1");
  });
}

test.describe("Workflow tools (Phase 4)", () => {
  test.setTimeout(120_000);

  test("调色板添加文生图节点", async ({ page }) => {
    await skipCoach(page);
    await registerViaEmail(page, { emailPrefix: "wf-tool-add" });
    await gotoWorkflowAndWait(page, "/workflow");

    await page.getByTestId("workflow-tool-TEXT_TO_IMAGE").click();
    await expect(page.locator('[data-node-id^="wf-text_to_image-"]')).toHaveCount(1, {
      timeout: 10_000,
    });
    await expect(page.getByTestId(/^workflow-node-content-/)).toBeVisible();
  });

  test("文生图节点运行触发 story-canvas generate-image", async ({ page }) => {
    await skipCoach(page);
    await registerViaEmail(page, { emailPrefix: "wf-tool-run" });
    await gotoWorkflowAndWait(page, "/workflow");

    await page.getByTestId("workflow-tool-TEXT_TO_IMAGE").click();
    const runBtn = page.locator('[data-testid^="workflow-node-run-"]').first();
    await expect(runBtn).toBeVisible({ timeout: 10_000 });

    const generatePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/story-canvas/generate-image") &&
        res.request().method() === "POST",
      { timeout: 30_000 },
    );

    await runBtn.click();
    const res = await generatePromise;
    expect(res.ok(), `generate-image failed: ${await res.text()}`).toBeTruthy();
  });

  test("扩图节点无上游连接时提示错误", async ({ page }) => {
    await skipCoach(page);
    await registerViaEmail(page, { emailPrefix: "wf-tool-ref" });
    await gotoWorkflowAndWait(page, "/workflow");

    await page.getByTestId("workflow-tool-IMAGE_OUTPAINTING").click();
    const runBtn = page.locator('[data-testid^="workflow-node-run-"]').first();
    await expect(runBtn).toBeVisible({ timeout: 10_000 });
    await runBtn.click();

    await expect(page.getByText("请先连接上游图片节点")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("Agent 历史 Tab 可切换", async ({ page }) => {
    await skipCoach(page);
    await registerViaEmail(page, { emailPrefix: "wf-history" });
    await gotoWorkflowAndWait(page, "/workflow");

    await page.getByRole("button", { name: "历史" }).click();
    await expect(page.getByText("暂无历史对话")).toBeVisible({ timeout: 10_000 });
  });

  test("工作流壳展示分享与模板入口", async ({ page }) => {
    await skipCoach(page);
    await registerViaEmail(page, { emailPrefix: "wf-shell" });
    await gotoWorkflowAndWait(page, "/workflow");

    await expect(page.getByTestId("workflow-share-toggle")).toBeVisible();
    await expect(page.getByTestId("template-manager-toggle")).toBeVisible();
    await expect(studioWorkstation(page)).toBeHidden({ timeout: 5_000 });
  });
});
