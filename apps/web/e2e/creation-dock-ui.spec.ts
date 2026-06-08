import { expect, test, type Page } from "@playwright/test";
import { skipStudioCoach } from "./helpers/studio";

async function mockSignedInStudio(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("aimarket_token", "e2e-dock-user-token");
    localStorage.setItem("aimarket_studio_dock_mode_v1", "expanded");
    localStorage.removeItem("aimarket.home.lane");
    localStorage.removeItem("aimarket.studio.lane");
    localStorage.removeItem("aimarket.home.laneDrafts");
    localStorage.removeItem("aimarket.studio.laneDrafts");
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
  test("首页创作台默认展开，滚出视口后底部单行常驻", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("aimarket.home.lane");
      localStorage.removeItem("aimarket.studio.lane");
      localStorage.removeItem("aimarket.creationDock.lane");
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const homeDock = page.locator("#home-creation");
    const textarea = homeDock.locator("textarea").first();
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute("rows", "2");
    const homeLanePicker = homeDock.getByRole("button", { name: "选择创作方式" });
    await expect(homeLanePicker).toContainText("图片生成");

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const floatingDock = page.locator('[data-home-floating-dock="true"]');
    await expect(floatingDock).toBeVisible();
    const floatingTextarea = floatingDock.locator("textarea").first();
    await expect(floatingTextarea).toHaveAttribute("rows", "1");

    const compactHeight = await floatingTextarea
      .boundingBox()
      .then((box) => box?.height ?? 0);
    await floatingTextarea.focus();
    await expect
      .poll(async () => (await floatingTextarea.boundingBox())?.height ?? 0, {
        timeout: 15_000,
      })
      .toBeGreaterThan(compactHeight + 6);
  });

  test("Studio 创作台默认图片车道，与首页同款单行布局", async ({ page }) => {
    await mockSignedInStudio(page);
    await page.goto("/studio", { waitUntil: "domcontentloaded" });

    const studioDock = page.locator('[aria-label="创作 Dock"]');
    const textarea = studioDock.locator("textarea").first();
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute("rows", "1");
    const studioLanePicker = studioDock.getByRole("button", {
      name: "选择创作方式",
    });
    await expect(studioLanePicker).toContainText("图片生成");
    await expect(
      studioDock.getByRole("button", { name: "选择模型" }),
    ).toContainText("Auto");

    const collapsedHeight = await textarea.boundingBox().then((box) => box?.height ?? 0);
    await textarea.click();
    await expect
      .poll(async () => (await textarea.boundingBox())?.height ?? 0)
      .toBeGreaterThan(collapsedHeight + 12);

    await expect(studioLanePicker).toContainText("图片生成");
  });

  test("首页与 Studio 车道偏好互不影响", async ({ page }) => {
    await mockSignedInStudio(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const homeDock = page.locator("#home-creation");
    await homeDock.getByRole("button", { name: "选择创作方式" }).click();
    await page.getByRole("button", { name: "Agent 模式", exact: true }).click();
    await expect(homeDock.getByRole("button", { name: "选择创作方式" })).toContainText(
      "Agent 模式",
    );

    await page.goto("/studio", { waitUntil: "domcontentloaded" });
    const studioDock = page.locator('[aria-label="创作 Dock"]');
    await expect(studioDock.getByRole("button", { name: "选择创作方式" })).toContainText(
      "图片生成",
    );
  });

  test("Studio 图片车道比例切到视频再切回后仍保留", async ({ page }) => {
    await skipStudioCoach(page);
    await mockSignedInStudio(page);
    await page.goto("/studio", { waitUntil: "domcontentloaded" });

    const studioDock = page.locator('[aria-label="创作 Dock"]');
    const textarea = studioDock.locator("textarea").first();
    await expect(textarea).toBeVisible();
    await textarea.click();

    const aspectButton = studioDock.getByRole("button", {
      name: "图片尺寸与分辨率",
    });
    await expect(aspectButton).toBeVisible({ timeout: 10_000 });
    await aspectButton.click();
    // CompactDockSheet 内容可能 portal 到 Dock 外
    await page
      .locator("button")
      .filter({ has: page.locator("span", { hasText: /^16:9$/ }) })
      .first()
      .click();
    await expect(aspectButton).toContainText("16:9");

    await studioDock.getByRole("button", { name: "选择创作方式" }).click();
    await page.getByRole("button", { name: "视频生成", exact: true }).click();
    await expect(studioDock.getByRole("button", { name: "选择创作方式" })).toContainText(
      "视频生成",
    );

    await studioDock.getByRole("button", { name: "选择创作方式" }).click();
    await page.getByRole("button", { name: "图片生成", exact: true }).click();
    await expect(studioDock.getByRole("button", { name: "选择创作方式" })).toContainText(
      "图片生成",
    );
    await expect(aspectButton).toContainText("16:9");
  });
});
