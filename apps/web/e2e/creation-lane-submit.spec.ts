import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  gotoStudioAndWait,
  skipStudioCoach,
  studioWorkstation,
} from "./helpers/studio";

const tinyImage = path.join(__dirname, "fixtures", "tiny.png");

test.describe("creation lane submit guard", () => {
  test("Studio Agent 车道有参考图时走 /ai/generate 而非 Agent", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    await skipStudioCoach(page);

    const apiBase = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";
    const email = `e2e_lane_guard_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}@test.local`;
    const register = await request.post(`${apiBase}/api/v1/auth/register`, {
      data: { email, password: "testpass123" },
    });
    expect(register.ok()).toBeTruthy();
    const body = (await register.json()) as { data?: { token?: string } };
    expect(body.data?.token).toBeTruthy();

    await page.addInitScript(() => {
      localStorage.setItem("aimarket.studio.lane", "agent");
    });

    page.on("dialog", (dialog) => dialog.accept());

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate((token) => {
      localStorage.setItem("aimarket_token", token);
    }, body.data!.token!);

    const postTargets: string[] = [];
    page.on("request", (req) => {
      if (req.method() !== "POST") return;
      const url = req.url();
      if (url.includes("/api/v1/ai/generate")) postTargets.push("generate");
      if (url.includes("/api/v1/agent/runs")) postTargets.push("agent");
    });

    await gotoStudioAndWait(page);
    const station = studioWorkstation(page);
    await expect(
      station.getByRole("button", { name: "选择创作方式" }),
    ).toContainText("Agent 模式");

    const uploadResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/assets/upload") &&
        res.request().method() === "POST",
      { timeout: 20_000 },
    );
    await station.locator('input[type="file"]').setInputFiles(tinyImage);
    expect((await uploadResponse).ok()).toBeTruthy();

    const canvasItem = page.locator('[data-testid^="canvas-item-upload-"]').first();
    await expect(canvasItem).toBeVisible({ timeout: 20_000 });
    await canvasItem.hover();
    await canvasItem.getByTestId("canvas-item-quick-mention").click();
    await expect(
      station.locator('[data-testid="reference-chip-mention-asset"]'),
    ).toBeVisible({
      timeout: 10_000,
    });

    const textarea = station.locator("textarea").first();
    await textarea.fill("E2E 图生图车道守卫：参考图应走图片生成");

    const generateResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/ai/generate") &&
        res.request().method() === "POST",
      { timeout: 30_000 },
    );
    await station.getByRole("button", { name: "开始生成" }).click();

    expect((await generateResponse).ok()).toBeTruthy();
    expect(postTargets).not.toContain("agent");
  });
});
