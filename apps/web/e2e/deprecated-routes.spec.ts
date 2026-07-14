import { expect, test } from "@playwright/test";

test.describe("deprecated canvas routes", () => {
  test("/workflow 永久重定向到 /studio", async ({ page }) => {
    await page.goto("/workflow?sessionId=test-session", {
      waitUntil: "domcontentloaded",
    });
    await expect(page).toHaveURL(/\/studio/, { timeout: 15_000 });
  });

  test("/workflows 永久重定向到 /studio", async ({ page }) => {
    await page.goto("/workflows", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/studio/, { timeout: 15_000 });
  });
});

test.describe("deprecated studio modes", () => {
  test("mode=production 规范为 mode=image", async ({ page }) => {
    await page.goto("/studio?mode=production&sessionId=test-prod-mode", {
      waitUntil: "domcontentloaded",
    });
    await expect(page).toHaveURL(/mode=image/, { timeout: 15_000 });
    await expect(page).not.toHaveURL(/mode=production/);
  });
});
