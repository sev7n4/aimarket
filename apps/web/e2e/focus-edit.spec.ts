import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { registerViaEmail } from "./helpers/auth";
import { studioWorkstation, skipStudioCoach } from "./helpers/studio";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function waitForGenerationSettled(page: import("@playwright/test").Page) {
  const overlay = page.locator('[role="status"][aria-live="polite"]');
  await expect(overlay).toBeHidden({ timeout: 120_000 });
}

test.describe("focus edit", () => {
  test("上传图片后点选焦点并提交工具任务", async ({ page }) => {
    test.setTimeout(180_000);
    await registerViaEmail(page, { emailPrefix: "e2e_focus" });
    await skipStudioCoach(page);

    const sessionId = randomUUID();
    await page.goto(`/studio?sessionId=${sessionId}&mode=chat`);
    await expect(page).toHaveURL(/\/studio/, { timeout: 15_000 });

    const station = studioWorkstation(page);
    await expect(station).toBeVisible({ timeout: 15_000 });

    const fileInput = page.locator('input[type="file"]').first();
    await station.getByTitle("上传图片").click();
    await fileInput.setInputFiles({
      name: "focus-source.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });

    const canvasImage = page
      .locator('[role="button"]')
      .filter({ has: page.locator("img") })
      .first();
    await expect(canvasImage).toBeVisible({ timeout: 20_000 });
    await canvasImage.click();

    await page.getByTestId("canvas-tool-focus-edit").click();
    const confirmDialog = page.getByTestId("tool-confirm-dialog");
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
    await confirmDialog.getByRole("button", { name: "开始点选" }).click();
    await expect(page.getByTestId("focus-edit-canvas-banner")).toBeVisible({
      timeout: 10_000,
    });

    await canvasImage.click({ position: { x: 20, y: 20 }, force: true });
    await expect(station.getByTestId("focus-edit-panel")).toBeVisible({
      timeout: 15_000,
    });
    await expect(station.getByTestId("focus-edit-chip-0")).toBeVisible({
      timeout: 15_000,
    });

    const textarea = station.locator("textarea").first();
    await textarea.fill("改成红色");
    await station.getByRole("button", { name: "开始生成" }).click();

    await waitForGenerationSettled(page);
    await expect(page.getByText(/【焦点编辑】|焦点编辑/).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
