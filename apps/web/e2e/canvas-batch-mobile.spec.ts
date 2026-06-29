import { test, expect } from "@playwright/test";
import { registerViaEmail } from "./helpers/auth";

const MOBILE_VIEWPORT = { width: 390, height: 844 };

async function registerAndOpenStudioMobile(
  page: import("@playwright/test").Page,
) {
  await page.addInitScript(() => {
    localStorage.setItem("aimarket_studio_coach_v2", "1");
    localStorage.setItem("aimarket_studio_mobile_coach_v1", "1");
    // E2E 用例基于 scroll-canvas 编写，强制关闭节点画布模式
    localStorage.setItem("aimarket_canvas_flow", "0");
  });
  await registerViaEmail(page, { emailPrefix: "e2e_batch_m" });

  const homePanel = page.locator("#home-creation");
  const textarea = homePanel.locator("textarea").first();
  await expect(textarea).toBeVisible({ timeout: 10_000 });
  await textarea.fill("E2E 移动批次：红色马克杯产品图");
  await homePanel.getByRole("button", { name: "开始生成" }).click();
  await expect(page).toHaveURL(/\/studio/, { timeout: 20_000 });
}

async function waitForGenerationSettled(page: import("@playwright/test").Page) {
  await expect(
    page.locator('[role="status"][aria-live="polite"]'),
  ).toBeHidden({ timeout: 120_000 });
}

test.describe("canvas batch stream mobile", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("移动端生成完成后展示批次分区", async ({ page }) => {
    test.setTimeout(150_000);
    await registerAndOpenStudioMobile(page);

    await expect(page.getByText(/画布\s*·/).first()).toBeVisible({
      timeout: 15_000,
    });
    await waitForGenerationSettled(page);
    const batchSection = page
      .locator('[data-testid^="canvas-batch-section-"]')
      .first();
    await expect(batchSection).toBeVisible({ timeout: 30_000 });
    await expect(batchSection).toContainText(/批次/);
  });

  test("移动端 Dock 默认展示模型与发送", async ({ page }) => {
    test.setTimeout(60_000);
    await registerAndOpenStudioMobile(page);

    const dock = page.locator('[aria-label="创作 Dock"]');
    await expect(dock).toBeVisible({ timeout: 15_000 });
    await expect(dock.getByRole("button", { name: "开始生成" })).toBeVisible({
      timeout: 15_000,
    });
  });
});
