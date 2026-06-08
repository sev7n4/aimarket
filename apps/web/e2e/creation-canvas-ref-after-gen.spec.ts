import { expect, test } from "@playwright/test";
import { registerViaEmail } from "./helpers/auth";
import {
  gotoStudioAndWait,
  skipStudioCoach,
  studioWorkstation,
} from "./helpers/studio";

async function waitForGenerationCycle(page: import("@playwright/test").Page) {
  const overlay = page.locator('[role="status"][aria-live="polite"]');
  await expect(overlay).toBeVisible({ timeout: 30_000 });
  await expect(overlay).toBeHidden({ timeout: 120_000 });
}

test.describe("canvas reference after generation", () => {
  test("生成完成后不自动绑定参考，第二次仍为文生图", async ({ page }) => {
    test.setTimeout(180_000);
    page.on("dialog", (dialog) => dialog.accept());
    await skipStudioCoach(page);
    await registerViaEmail(page, { emailPrefix: "e2e_ref_after_gen" });

    await page.evaluate(() => {
      localStorage.setItem("aimarket.studio.lane", "image");
    });
    await gotoStudioAndWait(page);

    const station = studioWorkstation(page);
    const textarea = station.locator("textarea").first();

    await textarea.fill("E2E 第一次文生图：蓝色水杯");
    await station.getByRole("button", { name: "开始生成" }).click();
    await waitForGenerationCycle(page);

    await expect(station.getByText(/已选用画布.*作参考/)).toHaveCount(0);

    const secondGenerate = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/ai/generate") &&
        res.request().method() === "POST",
      { timeout: 30_000 },
    );

    await textarea.fill("E2E 第二次文生图：红色水杯");
    await station.getByRole("button", { name: "开始生成" }).click();

    const res = await secondGenerate;
    expect(res.ok()).toBeTruthy();
    const payload = res.request().postDataJSON() as {
      referenceOutputIds?: string[];
      assetIds?: string[];
      count?: number;
    };
    expect(payload.referenceOutputIds ?? []).toHaveLength(0);
    expect(payload.assetIds ?? []).toHaveLength(0);
  });
});
