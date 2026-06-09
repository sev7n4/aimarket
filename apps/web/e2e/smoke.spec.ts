import { test, expect } from "@playwright/test";
import { registerViaEmail } from "./helpers/auth";

test.describe("smoke", () => {
  test("首页展示品牌与 Slogan", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByTestId("app-left-rail").getByRole("link", { name: "墨鱼π" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "开始你的创意，创造无限可能",
      }),
    ).toBeVisible();
  });

  test("注册后可看到积分", async ({ page }) => {
    await registerViaEmail(page, { emailPrefix: "e2e_smoke" });
  });

  test("项目页可打开", async ({ page }) => {
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.getByRole("heading", { name: "项目库" })).toBeVisible();
  });

  test("首页提交后 Studio 显示流式进度", async ({ page }) => {
    await registerViaEmail(page, { emailPrefix: "e2e_stream" });

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

  test("点击灵感卡片做同款进入 Studio", async ({ page }) => {
    await registerViaEmail(page, { emailPrefix: "e2e_insp" });

    const card = page
      .getByRole("button")
      .filter({ hasText: "产品摄影图" })
      .first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "产品摄影图" }),
    ).toBeVisible({ timeout: 10_000 });
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "做同款", exact: true })
      .click();
    await expect(page).toHaveURL(/\/studio/, { timeout: 15_000 });
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 15_000 });
    await expect(textarea).toHaveValue(/大理石|产品|摄影/, { timeout: 10_000 });
  });
});
