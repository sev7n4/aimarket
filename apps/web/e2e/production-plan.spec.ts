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
    test.setTimeout(360_000);
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

    await expect
      .poll(
        async () => {
          if (
            await page
              .getByTestId("drama-shot-timeline")
              .isVisible()
              .catch(() => false)
          ) {
            return "completed";
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
        { timeout: 90_000, intervals: [250, 500, 1000] },
      )
      .toBe("completed");

    const planDoneRes = await request.get(
      `${apiBase}/api/v1/drama/plan/runs/${planId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const planDoneJson = (await planDoneRes.json()) as {
      data?: { projectId?: string };
    };
    const projectId = planDoneJson.data?.projectId;
    expect(projectId).toBeTruthy();

    const packagesRes = await request.get(`${apiBase}/api/v1/product/packages`, {
      headers: { Authorization: `Bearer ${token}` } },
    );
    const packagesJson = (await packagesRes.json()) as {
      data?: Array<{ id: string; credits?: number }>;
    };
    const largestPackage = packagesJson.data
      ?.slice()
      .sort((a, b) => (b.credits ?? 0) - (a.credits ?? 0))[0];
    if (largestPackage?.id) {
      await request.post(`${apiBase}/api/v1/product/purchase`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { packageId: largestPackage.id },
      });
    }

    const panel = page.getByTestId("drama-studio-panel");
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await expect(panel.getByText(/分镜板（\d+ 镜）/)).toBeVisible({
      timeout: 30_000,
    });
    await expect(panel.getByText(/角色资产（\d+）/)).toBeVisible();
    await expect(panel.getByTestId("drama-characters-lock-hint")).toBeVisible();
    await expect(panel.getByTestId("drama-confirm-produce")).toBeDisabled();

    const characterCards = panel.locator('[data-testid^="drama-character-card-"]');
    const charCount = await characterCards.count();
    expect(charCount).toBeGreaterThan(0);

    for (let i = 0; i < charCount; i++) {
      const card = characterCards.nth(i);
      const cardTestId = await card.getAttribute("data-testid");
      const charId = cardTestId?.replace("drama-character-card-", "");
      expect(charId).toBeTruthy();

      const turnaroundResponse = page.waitForResponse(
        (res) =>
          res.url().includes("/turnaround") &&
          res.request().method() === "POST",
        { timeout: 90_000 },
      );
      await expect(
        card.getByTestId("drama-character-turnaround-generate"),
      ).toBeEnabled({ timeout: 30_000 });
      await card.getByTestId("drama-character-turnaround-generate").click();
      const turnaroundRes = await turnaroundResponse;
      expect(turnaroundRes.ok()).toBeTruthy();

      await expect
        .poll(
          async () => {
            const res = await request.get(
              `${apiBase}/api/v1/drama/projects/${projectId}`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            const json = (await res.json()) as {
              data?: {
                project?: {
                  characters?: Array<{
                    id: string;
                    refOutputIds?: {
                      front?: string;
                      three_quarter?: string;
                      side?: string;
                    };
                  }>;
                };
              };
            };
            const char = json.data?.project?.characters?.find(
              (c) => c.id === charId,
            );
            const ids = char?.refOutputIds;
            return Boolean(ids?.front && ids?.three_quarter && ids?.side);
          },
          { timeout: 120_000, intervals: [500, 1000, 2000] },
        )
        .toBe(true);

      await page.reload({ waitUntil: "domcontentloaded" });
      const refreshedPanel = page.getByTestId("drama-studio-panel");
      await expect(refreshedPanel).toBeVisible({ timeout: 30_000 });
      const refreshedCard = refreshedPanel.locator(
        `[data-testid="drama-character-card-${charId}"]`,
      );
      await expect(
        refreshedCard.getByTestId("drama-character-turnaround-lock"),
      ).toBeVisible({ timeout: 30_000 });
      await refreshedCard.getByTestId("drama-character-turnaround-lock").click();
      await expect(
        refreshedCard.getByTestId("drama-character-turnaround-status"),
      ).toHaveText("已定稿", { timeout: 15_000 });
    }

    const panelAfterLock = page.getByTestId("drama-studio-panel");
    await expect(panelAfterLock.getByTestId("drama-characters-lock-hint")).toBeHidden();
    await expect(panelAfterLock.getByTestId("drama-confirm-produce")).toBeEnabled();

    const shotTimeline = page.getByTestId("drama-shot-timeline");
    await expect(shotTimeline).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("drama-shot-track")).toBeVisible();
    await expect(page.getByTestId("drama-shot-card-1")).toBeVisible();
    await expect(page.getByTestId("drama-shot-detail")).toBeVisible();
    await expect(panelAfterLock.getByTestId("drama-storyboard-timeline-hint")).toBeVisible();

    const projectRes = await request.get(
      `${apiBase}/api/v1/drama/projects/${projectId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const projectJson = (await projectRes.json()) as {
      data?: { project?: Record<string, unknown> };
    };
    await request.patch(`${apiBase}/api/v1/drama/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        project: {
          ...projectJson.data?.project,
          productionParams: {
            ...(projectJson.data?.project as { productionParams?: object })
              ?.productionParams,
            previewTier: "low",
          },
        },
      },
    });

    const sessionId = new URL(page.url()).searchParams.get("sessionId");
    expect(sessionId).toBeTruthy();
    const produceApi = await request.post(
      `${apiBase}/api/v1/drama/projects/${projectId}/produce`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { sessionId, confirmed: true },
      },
    );
    expect(produceApi.ok()).toBeTruthy();
    const produceJson = (await produceApi.json()) as {
      data?: { id?: string; status?: string };
    };
    const runId = produceJson.data?.id;
    expect(runId).toBeTruthy();

    await page.reload({ waitUntil: "domcontentloaded" });
    const panelAfterProduce = page.getByTestId("drama-studio-panel");
    await expect(panelAfterProduce).toBeVisible({ timeout: 30_000 });

    const productionTimeline = page.getByTestId("drama-production-timeline");
    await expect(productionTimeline).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("drama-production-progress-bar")).toBeVisible();
    await expect(page.getByTestId("drama-production-shot-track")).toBeVisible();
    await expect(
      panelAfterProduce.getByTestId("drama-production-timeline-hint"),
    ).toBeVisible();
    await expect(
      panelAfterProduce.getByTestId("drama-production-panel-progress"),
    ).toBeVisible();
    await expect(panelAfterProduce.getByTestId("drama-node-graph")).toBeVisible({
      timeout: 30_000,
    });

    await expect
      .poll(
        async () => {
          const res = await request.get(
            `${apiBase}/api/v1/drama/runs/${runId}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const json = (await res.json()) as {
            data?: { status?: string };
          };
          return json.data?.status ?? "running";
        },
        { timeout: 180_000, intervals: [1000, 2000, 3000] },
      )
      .toMatch(/completed|failed|waiting_confirm/);
  });
});
