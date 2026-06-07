import path from "node:path";
import { expect, test } from "@playwright/test";
import { gotoStudioAndWait, skipStudioCoach, studioWorkstation } from "./helpers/studio";

const tinyImage = path.join(__dirname, "fixtures", "tiny.png");

test.describe("studio upload references", () => {
  test("上传图片后展示在创作台、素材区和 @ 引用列表", async ({ page, request }) => {
    test.setTimeout(90_000);
    await skipStudioCoach(page);
    const apiBase = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";
    const email = `e2e_studio_upload_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}@test.local`;
    const register = await request.post(`${apiBase}/api/v1/auth/register`, {
      data: { email, password: "testpass123" },
    });
    expect(register.ok()).toBeTruthy();
    const body = (await register.json()) as { data?: { token?: string } };
    expect(body.data?.token).toBeTruthy();
    await page.route("**/api/v1/user/getInfo", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "e2e-studio-upload-user",
            email,
            credits: 10000,
            created_at: "2024-01-01T00:00:00.000Z",
          },
        }),
      }),
    );
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate((token) => {
      localStorage.setItem("aimarket_token", token);
    }, body.data!.token!);

    await gotoStudioAndWait(page);

    const station = studioWorkstation(page);

    const uploadResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/assets/upload") &&
        res.request().method() === "POST",
      { timeout: 20_000 },
    );
    await station.locator('input[type="file"]').setInputFiles(tinyImage);
    expect((await uploadResponse).ok()).toBeTruthy();

    const previewCard = station.getByTestId("upload-preview-card-0");
    await expect(previewCard).toBeVisible({ timeout: 20_000 });
    await expect(previewCard.locator("img")).toHaveAttribute(
      "src",
      /\/uploads\//,
      { timeout: 20_000 },
    );

    await expect(page.getByText("素材区").first()).toBeVisible({
      timeout: 20_000,
    });
    const uploadedCanvasItem = page.locator('[data-testid^="canvas-item-upload-"]');
    await expect(uploadedCanvasItem).toHaveCount(1, { timeout: 20_000 });
    await expect(uploadedCanvasItem.first().locator("img")).toHaveAttribute(
      "src",
      /\/uploads\/thumbs\//,
      { timeout: 20_000 },
    );

    await uploadedCanvasItem.first().hover();
    await expect(
      uploadedCanvasItem.first().getByTestId("canvas-item-quick-mention"),
    ).toBeVisible({ timeout: 10_000 });
    await uploadedCanvasItem.first().getByTestId("canvas-item-quick-mention").click();
    await expect(page.getByText(/@ 引用了 1 张素材图/)).toBeVisible({
      timeout: 10_000,
    });
    await uploadedCanvasItem.first().hover();
    await expect(uploadedCanvasItem.first().getByTitle("更多").first()).toBeVisible({
      timeout: 10_000,
    });
    await uploadedCanvasItem.first().getByTitle("更多").first().click();
    await expect(
      page.getByRole("button", { name: /下载|分享|重做/ }).first(),
    ).toBeVisible({ timeout: 10_000 });
    await page.getByLabel("关闭菜单").click();

    await station.getByRole("button", { name: "引用画布图片" }).click();
    await expect(page.getByRole("button", { name: /上传图1.*当前上传/ })).toBeVisible({
      timeout: 10_000,
    });
  });
});
