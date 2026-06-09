import { expect, test, type Page } from "@playwright/test";

const MOCK_SESSIONS = [
  {
    id: "sess-rail-1",
    title: "春季主图",
    mode: "chat",
    kind: "canvas",
    created_at: "2024-06-01T00:00:00.000Z",
    updated_at: "2024-06-02T00:00:00.000Z",
  },
  {
    id: "sess-rail-2",
    title: "未命名",
    mode: "chat",
    kind: "canvas",
    created_at: "2024-05-01T00:00:00.000Z",
    updated_at: "2024-05-02T00:00:00.000Z",
  },
];

async function mockSignedInHome(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("aimarket_token", "e2e-rail-user-token");
    localStorage.removeItem("aimarket.home.lane");
    localStorage.removeItem("aimarket.studio.lane");
    localStorage.removeItem("aimarket.creationDock.lane");
  });

  await page.route("**/api/v1/user/getInfo", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: "rail-user-1",
          email: "rail-user@example.test",
          credits: 100,
          created_at: "2024-01-01T00:00:00.000Z",
        },
      }),
    }),
  );
  await page.route("**/api/v1/imageSession/list**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: MOCK_SESSIONS }),
    }),
  );
}

test.describe("home left rail", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("全站左轨展示品牌与开始创作，最近 hover 展开", async ({ page }) => {
    await mockSignedInHome(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const rail = page.getByTestId("app-left-rail");
    await expect(rail).toBeVisible();
    await expect(rail.getByRole("link", { name: "墨鱼π" })).toBeVisible();
    await expect(rail.getByRole("button", { name: "开始创作" })).toBeVisible();
    await expect(rail.getByRole("button", { name: "最近" })).toBeVisible();
    await expect(rail.getByRole("button", { name: "灵感发现" })).toBeVisible();
    await expect(rail.getByRole("button", { name: "灵感套件" })).toBeVisible();

    await page.getByTestId("home-recent-rail-btn").hover();
    const popover = page.getByTestId("home-recent-popover");
    await expect(popover).toBeVisible();
    await expect(popover.getByRole("link", { name: "春季主图" })).toBeVisible();
    await expect(
      popover.getByRole("link", { name: /未命名画布/ }),
    ).toBeVisible();
  });

  test("未登录用户桌面端展示左轨且无汉堡菜单", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("app-left-rail")).toBeVisible();
    await expect(page.getByRole("button", { name: "打开菜单" })).toHaveCount(0);
  });

  test("登录用户滚出视口后贴底 Dock 仍正常且避开左轨", async ({ page }) => {
    await mockSignedInHome(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const floatingDock = page.locator('[data-home-floating-dock="true"]');
    await expect(floatingDock).toBeVisible();

    const railBox = await page.getByTestId("app-left-rail").boundingBox();
    const dockBox = await floatingDock.boundingBox();
    expect(railBox).not.toBeNull();
    expect(dockBox).not.toBeNull();
    if (railBox && dockBox) {
      expect(dockBox.x).toBeGreaterThanOrEqual(railBox.x + railBox.width - 2);
    }

    const textarea = floatingDock.locator("textarea").first();
    await expect(textarea).toHaveAttribute("rows", "2");
    await expect(floatingDock.getByTestId("upload-preview-add")).toBeVisible();
  });
});
