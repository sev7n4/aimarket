import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { registerViaEmail } from "./helpers/auth";
import { studioWorkstation, skipStudioCoach } from "./helpers/studio";

/** 12×12 PNG，避免 1×1 在滚动画布上布局异常 */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC",
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

    const uploadDone = page.waitForResponse(
      (r) => r.url().includes("/assets/upload") && r.ok(),
      { timeout: 30_000 },
    );
    await page.locator('input[type="file"][aria-label="上传图片"]').setInputFiles({
      name: "focus-source.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await uploadDone;

    const focusTarget = page.locator('[data-testid^="canvas-item-"]').first();
    await expect(focusTarget).toBeVisible({ timeout: 20_000 });
    await focusTarget.scrollIntoViewIfNeeded();
    await focusTarget.click();
    await focusTarget.hover();

    const focusTool = page
      .getByTestId("canvas-batch-tool-focus-edit")
      .or(page.getByTestId("canvas-tool-focus-edit"))
      .or(page.getByRole("button", { name: "焦点" }));
    await expect(focusTool.first()).toBeVisible({ timeout: 10_000 });
    await focusTool.first().click();
    const confirmDialog = page.getByTestId("tool-confirm-dialog");
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
    await confirmDialog.getByRole("button", { name: "开始点选" }).click();
    await expect(page.getByTestId("focus-edit-canvas-banner")).toBeVisible({
      timeout: 10_000,
    });

    const focusPointDone = page.waitForResponse(
      (r) => r.url().includes("/focus/point") && r.ok(),
      { timeout: 30_000 },
    );
    await focusTarget.click({ force: true });
    await focusPointDone;
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
