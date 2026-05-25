import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("首页展示品牌标题", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "修图，就用 AIMarket" }),
    ).toBeVisible();
  });

  test("注册后可看到积分", async ({ page }) => {
    const email = `e2e_${Date.now()}@test.local`;
    await page.goto("/");
    await page.getByRole("banner").getByRole("button", { name: "免费开始" }).click();
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
});
