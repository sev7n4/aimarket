import { test, expect } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 390, height: 844 };

async function registerAndLogin(page: import("@playwright/test").Page) {
  const email = `e2e_mobile_${Date.now()}@test.local`;
  await page.goto("/");
  await page.getByRole("banner").getByRole("button", { name: "免费开始" }).click();
  await page.getByRole("button", { name: "邮箱" }).click();
  await page.getByRole("button", { name: "立即注册" }).click();
  await page.getByPlaceholder("邮箱").fill(email);
  await page.getByPlaceholder("密码").fill("testpass123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "注册" }).click();
  await expect(page.getByText(/积分\s+\d+/)).toBeVisible({ timeout: 15_000 });
  return email;
}

test.describe("mobile collab", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("首页移动 dock 展示热门能力 chips", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("电商热门能力")).toBeVisible();
    await expect(page.getByRole("button", { name: "AI 扩图" })).toBeVisible();
    await expect(page.getByRole("button", { name: "白底主图" })).toBeVisible();
  });

  test("已登录首页展示继续编辑最近会话", async ({ page }) => {
    await registerAndLogin(page);
    const ensurePromise = page.waitForResponse(
      (r) =>
        r.url().includes("/api/v1/imageSession/ensure") &&
        r.request().method() === "POST" &&
        r.ok(),
      { timeout: 20_000 },
    );
    await page.goto("/studio");
    await expect(page).toHaveURL(/\/studio/, { timeout: 15_000 });
    await ensurePromise;
    await page.goto("/");
    await expect(page.getByText("继续编辑")).toBeVisible({ timeout: 15_000 });
  });

  test("创作页移动默认展示画布与可展开工作站", async ({ page }) => {
    await registerAndLogin(page);
    await page.addInitScript(() => {
      localStorage.setItem("aimarket_studio_mobile_coach_v1", "1");
    });
    await page.goto("/studio");
    await expect(page.getByText(/画布\s*·/).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "打开工作站" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("textarea").first()).not.toBeVisible();
    await page.getByRole("button", { name: "打开工作站" }).click();
    await expect(page.locator("textarea").first()).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "打开侧栏" }).click();
    await expect(page.getByRole("button", { name: "重命名" }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "删除项目" }).first()).toBeVisible();
    await expect(page.getByText("Del 删除")).not.toBeVisible();
  });

  test("首页提交后创作页画布可见生成进度", async ({ page }) => {
    await registerAndLogin(page);
    const homePanel = page.locator("#home-creation");
    const textarea = homePanel.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 10_000 });
    await textarea.fill("E2E 移动协同：红色苹果产品摄影");
    await homePanel.getByRole("button", { name: "开始生成" }).click();

    await expect(page).toHaveURL(/\/studio.*jobId=/, { timeout: 25_000 });
    await expect(
      page.getByText(/排队中|生成中|处理中|已完成/).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("首次进创作页展示移动引导并可跳过", async ({ page }) => {
    await registerAndLogin(page);
    await page.addInitScript(() => {
      localStorage.removeItem("aimarket_studio_mobile_coach_v1");
    });
    await page.goto("/studio");
    await expect(page.getByText("快速上手")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "跳过引导" }).click();
    await expect(page.getByText("快速上手")).not.toBeVisible();
  });

  test("需选图工具深链未选图时画布显示提示", async ({ page }) => {
    await registerAndLogin(page);
    await page.goto("/studio?tool=cutout");
    await expect(
      page.getByText(/请先在画布点选一张图片/).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
