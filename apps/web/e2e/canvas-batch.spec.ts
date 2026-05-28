import { test, expect } from "@playwright/test";
import { registerViaEmail } from "./helpers/auth";

async function startGenerationFromHome(
  page: import("@playwright/test").Page,
  prompt: string,
) {
  const homePanel = page.locator("#home-creation");
  const textarea = homePanel.locator("textarea").first();
  await expect(textarea).toBeVisible({ timeout: 10_000 });
  await textarea.fill(prompt);
  await homePanel.getByRole("button", { name: "开始生成" }).click();
  await expect(page).toHaveURL(/\/studio/, { timeout: 20_000 });
}

/** 等待画布 job 浮层消失，避免挡住批次头点击 */
async function waitForGenerationSettled(page: import("@playwright/test").Page) {
  const overlay = page.locator('[role="status"][aria-live="polite"]');
  await expect(overlay).toBeHidden({ timeout: 120_000 });
}

async function waitForFirstBatch(page: import("@playwright/test").Page) {
  await waitForGenerationSettled(page);
  const batchSection = page
    .locator('[data-testid^="canvas-batch-section-"]')
    .first();
  await expect(batchSection).toBeVisible({ timeout: 30_000 });
  await expect(batchSection).toContainText(/批次\s*1/);
  return batchSection;
}

async function submitSecondGenerationInStudio(
  page: import("@playwright/test").Page,
  prompt: string,
) {
  const station = page.locator('section[aria-label="工作站"]');
  const textarea = station.locator("textarea").first();
  await expect(textarea).toBeVisible({ timeout: 15_000 });
  await textarea.fill(prompt);
  await station.getByRole("button", { name: "开始生成" }).click();
}

test.describe("canvas batch stream", () => {
  test("生成完成后展示批次分区", async ({ page }) => {
    test.setTimeout(150_000);
    await registerViaEmail(page, { emailPrefix: "e2e_batch" });
    await startGenerationFromHome(page, "E2E 画布批次测试：简约产品图");
    await waitForFirstBatch(page);
  });

  test("点击批次头可聚焦该批", async ({ page }) => {
    test.setTimeout(150_000);
    await registerViaEmail(page, { emailPrefix: "e2e_batch_click" });
    await startGenerationFromHome(page, "E2E 画布批次点击：绿色水杯");
    const batchSection = await waitForFirstBatch(page);
    await batchSection.click({ force: true });
    await expect(batchSection).toBeVisible();
  });

  test("连续两次生成后出现批次 1 与批次 2", async ({ page }) => {
    test.setTimeout(240_000);
    await registerViaEmail(page, { emailPrefix: "e2e_batch_dual" });
    await startGenerationFromHome(page, "E2E 双批次第一次：白色耳机");
    await waitForFirstBatch(page);

    await submitSecondGenerationInStudio(
      page,
      "E2E 双批次第二次：黑色耳机产品摄影",
    );
    await waitForGenerationSettled(page);

    await expect(page.getByText(/批次\s*2/).first()).toBeVisible({
      timeout: 120_000,
    });
    await expect(
      page.locator('[data-testid^="canvas-batch-section-"]'),
    ).toHaveCount(2, { timeout: 30_000 });
  });
});
