import { expect, test } from "@playwright/test";
import {
  skipStudioCoach,
  studioWorkstation,
} from "./helpers/studio";

const PLAN_AGENTS = [
  "writer",
  "director",
  "character",
  "cinematographer",
  "storyboard",
] as const;

test.describe("production plan SSE", () => {
  test("制片模式提交 → 五步规划时间线 → 分镜板", async ({ page, request }) => {
    test.setTimeout(120_000);
    await skipStudioCoach(page);

    const apiBase = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";
    const email = `e2e_prod_plan_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}@test.local`;
    const register = await request.post(`${apiBase}/api/v1/auth/register`, {
      data: { email, password: "testpass123" },
    });
    expect(register.ok()).toBeTruthy();
    const body = (await register.json()) as { data?: { token?: string } };
    const token = body.data?.token;
    expect(token).toBeTruthy();

    page.on("dialog", (dialog) => dialog.accept());

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate((t) => {
      localStorage.setItem("aimarket_token", t);
    }, token!);

    await page.goto("/studio?mode=production", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/sessionId=/, { timeout: 30_000 });
    const station = studioWorkstation(page);
    await expect(station.locator("textarea").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(station.getByRole("button", { name: "开始规划" })).toBeEnabled({
      timeout: 15_000,
    });

    await expect(station.getByTestId("drama-production-dock-params")).toBeVisible({
      timeout: 15_000,
    });
    await expect(station.getByTestId("drama-auto-produce-checkbox")).toBeVisible();

    const idea =
      "都市爱情短剧：咖啡店老板与常客在雨夜重逢，三分钟讲完误会与和解";
    const textarea = station.locator("textarea").first();
    await textarea.fill(idea);

    const planResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/drama/plan/runs") &&
        res.request().method() === "POST" &&
        res.ok(),
      { timeout: 60_000 },
    );
    await station.getByRole("button", { name: "开始规划" }).click();
    const planRes = await planResponse;
    const planJson = (await planRes.json()) as {
      data?: { id?: string; status?: string };
    };
    const planId = planJson.data?.id;
    expect(planId).toBeTruthy();
    expect(planJson.data?.status).toBe("planning");

    await expect(page.getByTestId("drama-plan-timeline")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("drama-plan-stepper")).toBeVisible();
    await expect(page.getByTestId("drama-plan-event-feed")).toBeVisible();

    let sawTimelineLabels = false;

    await expect
      .poll(
        async () => {
          const timeline = page.getByTestId("drama-plan-timeline");
          if (await timeline.isVisible().catch(() => false)) {
            const text = await timeline.innerText();
            if (text.includes("编剧") && text.includes("分镜")) {
              sawTimelineLabels = true;
            }
          }

          const res = await request.get(
            `${apiBase}/api/v1/drama/plan/runs/${planId}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const json = (await res.json()) as {
            data?: {
              status?: string;
              agents?: Record<string, { status?: string }>;
            };
          };
          const data = json.data;
          if (data?.status !== "completed") return "planning";

          const allDone = PLAN_AGENTS.every(
            (id) => data.agents?.[id]?.status === "done",
          );
          return allDone ? "completed" : "planning";
        },
        { timeout: 60_000, intervals: [100, 250, 500] },
      )
      .toBe("completed");

    if (!sawTimelineLabels) {
      const agentsRes = await request.get(
        `${apiBase}/api/v1/drama/plan/runs/${planId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const agentsBody = (await agentsRes.json()) as {
        data?: { agents?: Record<string, { status?: string }> };
      };
      for (const id of PLAN_AGENTS) {
        expect(agentsBody.data?.agents?.[id]?.status).toBe("done");
      }
    }

    const panel = page.getByTestId("drama-studio-panel");
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await expect(panel.getByText(/分镜板（\d+ 镜）/)).toBeVisible({
      timeout: 30_000,
    });
    await expect(panel.getByText("角色资产")).toBeVisible();
    await expect(panel.getByTestId("drama-confirm-produce")).toBeVisible();
  });
});
