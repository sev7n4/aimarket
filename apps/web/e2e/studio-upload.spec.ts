import path from "node:path";
import { expect, test } from "@playwright/test";
import { registerViaEmail } from "./helpers/auth";
import { skipStudioCoach, studioWorkstation } from "./helpers/studio";

const tinyImage = path.join(__dirname, "fixtures", "tiny.png");

test.describe("studio upload references", () => {
  test("上传图片后展示在创作台、素材区和 @ 引用列表", async ({ page }) => {
    test.setTimeout(90_000);
    await skipStudioCoach(page);
    await registerViaEmail(page, { emailPrefix: "e2e_studio_upload" });

    await page.goto("/studio");
    await expect(page).toHaveURL(/\/studio/, { timeout: 15_000 });

    const station = studioWorkstation(page);
    await expect(station.locator("textarea").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: /积分/ })).toBeVisible({
      timeout: 15_000,
    });

    const uploadResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/assets/upload") &&
        res.request().method() === "POST",
      { timeout: 20_000 },
    );
    const fileChooserPromise = page.waitForEvent("filechooser");
    await station.getByRole("button", { name: "上传图片" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tinyImage);
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
    await expect(page.locator('[data-testid^="canvas-item-upload-"]')).toHaveCount(
      1,
      { timeout: 20_000 },
    );

    await station.getByRole("button", { name: "引用画布图片" }).click();
    await expect(page.getByRole("button", { name: /上传图1.*当前上传/ })).toBeVisible({
      timeout: 10_000,
    });
  });
});
