import { expect, test } from "@playwright/test";

test.describe("creation dock drag-drop upload", () => {
  test("首页创作台支持拖拽图片上传", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("aimarket_token", "e2e-drop-user-token");
    });
    await page.route("**/api/v1/user/getInfo", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "drop-user-1",
            email: "drop-user@example.test",
            credits: 100,
            created_at: "2024-01-01T00:00:00.000Z",
          },
        }),
      }),
    );
    await page.route("**/api/v1/imageSession/ensure", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: { id: "sess-drop" } }),
      }),
    );
    await page.route("**/api/v1/assets/upload", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "asset-drop-1",
            url: "/uploads/drop-test.png",
            thumbUrl: "/uploads/drop-test-thumb.png",
            mimeType: "image/png",
          },
        }),
      }),
    );

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const dropZone = page.getByTestId("creation-dock-drop-zone");
    await expect(dropZone).toBeVisible();
    await expect(page.getByTestId("app-left-rail")).toBeVisible();

    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

    await dropZone.evaluate(async (el, b64) => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], "drop-test.png", { type: "image/png" });
      const dt = new DataTransfer();
      dt.items.add(file);
      el.dispatchEvent(
        new DragEvent("dragenter", { bubbles: true, dataTransfer: dt }),
      );
      el.dispatchEvent(
        new DragEvent("dragover", { bubbles: true, dataTransfer: dt }),
      );
      el.dispatchEvent(
        new DragEvent("drop", { bubbles: true, dataTransfer: dt }),
      );
    }, pngBase64);

    await expect(dropZone.getByTestId("upload-preview-card-0")).toBeVisible({
      timeout: 10_000,
    });
  });
});
