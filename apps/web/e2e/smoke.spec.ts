import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("首页展示品牌标题", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "电商出图，就用 AIMarket" }),
    ).toBeVisible();
  });

  test("注册后可看到积分", async ({ page }) => {
    const email = `e2e_${Date.now()}@test.local`;
    await page.goto("/");
    await page.getByRole("banner").getByRole("button", { name: "免费开始" }).click();
    await page.getByRole("button", { name: "邮箱" }).click();
    await page.getByRole("button", { name: "立即注册" }).click();
    await expect(
      page.getByRole("heading", { name: "注册 AIMarket" }),
    ).toBeVisible();
    await page.getByPlaceholder("邮箱").fill(email);
    await page.getByPlaceholder("密码").fill("testpass123");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "注册" }).click();
    await expect(page.getByText(/积分\s+\d+/)).toBeVisible({ timeout: 15_000 });
  });

  test("项目页可打开", async ({ page }) => {
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.getByRole("heading", { name: "项目库" })).toBeVisible();
  });

  test("首页提交后 Studio 显示流式进度", async ({ page }) => {
    const email = `e2e_stream_${Date.now()}@test.local`;
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
    await textarea.fill("E2E 流式生成测试：一只可爱的猫");
    await homePanel.getByRole("button", { name: "开始生成" }).click();

    await expect(page).toHaveURL(/\/studio/, { timeout: 20_000 });
    await expect(
      page.getByText(/排队中|生成中|处理中/).first(),
    ).toBeVisible({ timeout: 25_000 });
  });

  test("点击灵感卡片灌入工作台 Prompt", async ({ page }) => {
    await page.goto("/");
    const card = page
      .getByRole("button")
      .filter({ hasText: "产品摄影图" })
      .first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();
    const textarea = page.locator("#home-creation textarea").first();
    await expect(textarea).toHaveValue(/大理石|产品|摄影/, { timeout: 10_000 });
  });
});
