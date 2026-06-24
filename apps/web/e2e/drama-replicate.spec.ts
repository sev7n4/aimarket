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

test.describe("drama replicate", () => {
  test("复刻 Tab → 分析结构 → 规划完成", async ({ page, request }) => {
    test.setTimeout(120_000);
    await skipStudioCoach(page);

    const apiBase = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";
    const email = `e2e_replicate_${Date.now()}_${Math.random()
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

    await station.getByTestId("drama-production-mode-replicate").click();
    await expect(station.getByTestId("drama-replicate-dock-params")).toBeVisible();

    const videoUrl = "https://example.com/reference/viral-short.mp4";
    await station.getByTestId("drama-replicate-url").fill(videoUrl);

    const analyzeResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/drama/replicate/analyze") &&
        res.request().method() === "POST" &&
        res.ok(),
      { timeout: 30_000 },
    );
    await station.getByTestId("drama-replicate-analyze").click();
    const analyzeRes = await analyzeResponse;
    const analyzeJson = (await analyzeRes.json()) as {
      data?: { beatStructure?: string[]; sourceUrl?: string };
    };
    expect(analyzeJson.data?.sourceUrl).toBe(videoUrl);
    expect((analyzeJson.data?.beatStructure?.length ?? 0) >= 3).toBeTruthy();

    await expect(station.getByTestId("drama-replicate-profile-ready")).toBeVisible({
      timeout: 15_000,
    });

    const idea = "都市爱情：雨夜咖啡店重逢，用新角色讲完误会与和解";
    await station.locator("textarea").first().fill(idea);

    const planResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/drama/plan/runs") &&
        res.request().method() === "POST" &&
        res.ok(),
      { timeout: 60_000 },
    );
    await station.getByRole("button", { name: "开始规划" }).click();
    const planRes = await planResponse;
    const planRequest = planRes.request().postDataJSON() as {
      replicateProfile?: { sourceUrl?: string };
    };
    expect(planRequest.replicateProfile?.sourceUrl).toBe(videoUrl);

    const planJson = (await planRes.json()) as { data?: { id?: string } };
    const planId = planJson.data?.id;
    expect(planId).toBeTruthy();

    await expect
      .poll(
        async () => {
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
        { timeout: 90_000, intervals: [250, 500, 1000] },
      )
      .toBe("completed");

    const panel = page.getByTestId("drama-studio-panel");
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await expect(panel.getByText(/分镜板（\d+ 镜）/)).toBeVisible({
      timeout: 30_000,
    });
  });
});
