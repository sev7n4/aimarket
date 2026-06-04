import { expect, test, type Page } from "@playwright/test";

async function mockSignedInStudio(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("aimarket_token", "e2e-old-user-token");
    localStorage.setItem("aimarket_studio_dock_mode_v1", "expanded");
  });

  await page.route("**/api/v1/user/getInfo", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: "old-user-1",
          email: "old-user@example.test",
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
}

test.describe("studio coach mark", () => {
  test("老账号进入 Studio 不显示首次引导且不遮挡上传按钮", async ({ page }) => {
    await mockSignedInStudio(page);

    await page.goto("/studio", { waitUntil: "domcontentloaded" });

    const dock = page.locator('[aria-label="创作 Dock"]');
    await expect(dock.locator("textarea").first()).toBeVisible();
    await expect(page.getByText("快速上手")).toHaveCount(0);

    const uploadButton = dock.getByRole("button", { name: "上传图片" });
    await expect(uploadButton).toBeVisible();
    await expect(
      uploadButton.evaluate((button) => {
        const rect = button.getBoundingClientRect();
        const top = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return Boolean(top?.closest('button[aria-label="上传图片"]'));
      }),
    ).resolves.toBe(true);
  });
});
