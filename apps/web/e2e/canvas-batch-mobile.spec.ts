import { test, expect } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 390, height: 844 };

async function registerAndOpenStudioMobile(
  page: import("@playwright/test").Page,
) {
  const email = `e2e_batch_m_${Date.now()}@test.local`;
  await page.addInitScript(() => {
    localStorage.setItem("aimarket_studio_mobile_coach_v1", "1");
  });
  await page.goto("/");
  await page.getByRole("banner").getByRole("button", { name: "免费开始" }).click();
  await page.getByRole("button", { name: "邮箱" }).click();
  await page.getByRole("button", { name: "立即注册" }).click();
  await page.getByPlaceholder("邮箱").fill(email);
  await page.getByPlaceholder("密码").fill("testpass123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "注册" }).click();
  await expect(page.getByText(/积分\s+\d+/)).toBeVisible({ timeout: 15_000 });

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

  test("移动端可打开工作站", async ({ page }) => {
    test.setTimeout(150_000);
    await registerAndOpenStudioMobile(page);

    await page.getByRole("button", { name: "打开工作站" }).click();
    const station = page.locator('section[aria-label="工作站"]');
    await expect(station.locator("textarea").first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
