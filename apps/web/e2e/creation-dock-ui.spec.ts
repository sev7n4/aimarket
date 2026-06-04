import { expect, test, type Page } from "@playwright/test";

async function mockSignedInStudio(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("aimarket_token", "e2e-dock-user-token");
    localStorage.setItem("aimarket_studio_dock_mode_v1", "expanded");
    localStorage.removeItem("aimarket.creationDock.lane");
  });

  await page.route("**/api/v1/user/getInfo", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: "dock-user-1",
          email: "dock-user@example.test",
          credits: 100,
          created_at: "2024-01-01T00:00:00.000Z",
        },
      }),
    }),
  );
  await page.route("**/api/v1/imageSession/list**", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: [] }) }),
  );
  await page.route("**/api/v1/tools/list", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: [] }) }),
  );
  await page.route("**/api/v1/agent/skills", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: [] }) }),
  );
}

test.describe("creation dock UI", () => {
  test("首页创作台默认单行且包含 Agent 模式", async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem("aimarket.creationDock.lane"));
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const homeDock = page.locator("#home-creation");
    const textarea = homeDock.locator("textarea").first();
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute("rows", "1");
    const homeLanePicker = homeDock.getByRole("button", { name: "选择创作方式" });
    await expect(homeLanePicker).toContainText("图片生成");

    const collapsedHeight = await textarea.boundingBox().then((box) => box?.height ?? 0);
    await textarea.click();
    await expect
      .poll(async () => (await textarea.boundingBox())?.height ?? 0)
      .toBeGreaterThan(collapsedHeight + 12);

    await expect(homeLanePicker).toContainText("图片生成");
  });

  test("Studio 创作台与首页保持同款单行/Agent 布局", async ({ page }) => {
    await mockSignedInStudio(page);
    await page.goto("/studio", { waitUntil: "domcontentloaded" });

    const studioDock = page.locator('[aria-label="创作 Dock"]');
    const textarea = studioDock.locator("textarea").first();
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute("rows", "1");
    const studioLanePicker = studioDock.getByRole("button", {
      name: "选择创作方式",
    });
    await expect(studioLanePicker).toContainText("Agent 模式");

    const collapsedHeight = await textarea.boundingBox().then((box) => box?.height ?? 0);
    await textarea.click();
    await expect
      .poll(async () => (await textarea.boundingBox())?.height ?? 0)
      .toBeGreaterThan(collapsedHeight + 12);
  });
});
