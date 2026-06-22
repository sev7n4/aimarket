import { expect, test } from "@playwright/test";

test.describe("production entry", () => {
  test("首页展示制片 Hero 与三入口", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Agent 制片，画布交付" }),
    ).toBeVisible();
    await expect(page.getByText("短剧 · 创意片 · 商业片")).toBeVisible();
    await expect(page.getByTestId("home-entry-production")).toBeVisible();
    await expect(page.getByTestId("home-entry-ecommerce")).toBeVisible();
    await expect(page.getByTestId("home-entry-canvas")).toBeVisible();
  });

  test("点击开始制片进入 Studio production 模式", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("home-entry-production").click();
    await expect(page).toHaveURL(/\/studio\?.*mode=production/, {
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/sessionId=/);
  });

  test("制片 Studio 展示短剧规划占位", async ({ page }) => {
    await page.goto("/studio?mode=production");
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 15_000 });
    await expect(textarea).toHaveAttribute(
      "placeholder",
      /短剧创意|至少 10 字/,
    );
  });
});
