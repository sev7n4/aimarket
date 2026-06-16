import { expect, test } from "@playwright/test";
import {
  gotoStudioAndWait,
  skipStudioCoach,
  studioWorkstation,
  waitForSessionEnsure,
} from "./helpers/studio";

test.describe("AI 短剧全链路", () => {
  test("Agent 模式选短剧技能 → 规划 → 分镜板", async ({ page, request }) => {
    test.setTimeout(120_000);
    await skipStudioCoach(page);

    const apiBase = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";
    const email = `e2e_drama_${Date.now()}_${Math.random()
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

    await gotoStudioAndWait(page);
    const station = studioWorkstation(page);

    const lanePicker = station.getByRole("button", { name: "选择创作方式" });
    await expect(lanePicker).toBeVisible({ timeout: 15_000 });
    if (!(await lanePicker.textContent())?.includes("Agent")) {
      await lanePicker.click();
      await page.getByRole("button", { name: "Agent 模式", exact: true }).click();
    }
    await expect(lanePicker).toContainText("Agent 模式");

    await station.getByLabel("创意设计").click();
    await page.getByRole("button", { name: "AI 短剧", exact: true }).click();
    await expect(station.getByLabel("创意设计")).toContainText("AI 短剧");

    const idea =
      "都市爱情短剧：咖啡店老板与常客在雨夜重逢，三分钟讲完误会与和解";
    const textarea = station.locator("textarea").first();
    await textarea.fill(idea);

    const planResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/drama/runs") &&
        res.request().method() === "POST" &&
        res.ok(),
      { timeout: 60_000 },
    );
    const ensureResponse = waitForSessionEnsure(page);
    await station.getByRole("button", { name: "开始短剧规划" }).click();
    expect((await ensureResponse).ok()).toBeTruthy();
    const planRes = await planResponse;
    const planJson = (await planRes.json()) as {
      data?: { project?: { project?: { shots?: unknown[] } } };
    };
    expect(planJson.data?.project?.project?.shots?.length).toBeGreaterThan(7);

    const panel = page.getByTestId("drama-studio-panel");
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByText(/分镜板（\d+ 镜）/)).toBeVisible();
    await expect(panel.getByText("角色资产")).toBeVisible();
    await expect(panel.getByTestId("drama-confirm-produce")).toBeVisible();
  });
});
