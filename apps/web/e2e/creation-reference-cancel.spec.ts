import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  gotoStudioAndWait,
  skipStudioCoach,
  studioWorkstation,
  waitForSessionEnsure,
} from "./helpers/studio";

const tinyImage = path.join(__dirname, "fixtures", "tiny.png");

test.describe("reference cancel chips", () => {
  test("画布点选与 @ 引用均可通过 chip 取消", async ({ page, request }) => {
    test.setTimeout(90_000);
    await skipStudioCoach(page);

    const apiBase = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";
    const email = `e2e_ref_cancel_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}@test.local`;
    const register = await request.post(`${apiBase}/api/v1/auth/register`, {
      data: { email, password: "testpass123" },
    });
    expect(register.ok()).toBeTruthy();
    const body = (await register.json()) as { data?: { token?: string } };
    expect(body.data?.token).toBeTruthy();

    page.on("dialog", (dialog) => dialog.accept());

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate((token) => {
      localStorage.setItem("aimarket_token", token);
      localStorage.setItem("aimarket.studio.lane", "image");
    }, body.data!.token!);

    await gotoStudioAndWait(page);
    const station = studioWorkstation(page);

    const ensureResponse = waitForSessionEnsure(page);
    const uploadResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/assets/upload") &&
        res.request().method() === "POST",
      { timeout: 20_000 },
    );
    await station.locator('input[type="file"]').setInputFiles(tinyImage);
    expect((await ensureResponse).ok()).toBeTruthy();
    expect((await uploadResponse).ok()).toBeTruthy();

    const canvasItem = page.locator('[data-testid^="canvas-item-upload-"]').first();
    await expect(canvasItem).toBeVisible({ timeout: 20_000 });

    await canvasItem.click();
    const canvasChip = station.locator('[data-testid="reference-chip-canvas"]');
    await expect(canvasChip).toBeVisible({ timeout: 10_000 });

    const canvasRefId = await canvasChip.getAttribute("data-reference-id");
    expect(canvasRefId).toBeTruthy();
    await station
      .locator(`[data-testid="reference-chip-remove-${canvasRefId}"]`)
      .click();
    await expect(canvasChip).toBeHidden({ timeout: 5_000 });

    await canvasItem.hover();
    const quickMention = page.locator('[data-testid="canvas-item-quick-mention"]').first();
    await expect(quickMention).toBeVisible({ timeout: 5_000 });
    await quickMention.click();

    const mentionChip = station.locator('[data-testid="reference-chip-mention-asset"]');
    await expect(mentionChip).toBeVisible({ timeout: 10_000 });
    await expect(station.locator("textarea").first()).toContainText("@");

    const mentionRefId = await mentionChip.getAttribute("data-reference-id");
    expect(mentionRefId).toBeTruthy();
    await station
      .locator(`[data-testid="reference-chip-remove-${mentionRefId}"]`)
      .click();
    await expect(mentionChip).toBeHidden({ timeout: 5_000 });
    await expect(station.locator("textarea").first()).not.toContainText("@");

    const generateResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/ai/generate") &&
        res.request().method() === "POST",
      { timeout: 30_000 },
    );
    await station.locator("textarea").first().fill("E2E 取消引用后文生图");
    await station.getByRole("button", { name: "开始生成" }).click();

    const generateRes = await generateResponse;
    expect(generateRes.ok()).toBeTruthy();
    const payload = generateRes.request().postDataJSON() as {
      assetIds?: string[];
      referenceOutputIds?: string[];
    };
    expect(payload.assetIds?.length ?? 0).toBe(0);
    expect(payload.referenceOutputIds?.length ?? 0).toBe(0);
  });
});
