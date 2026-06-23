import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { skipStudioCoach, studioWorkstation } from "./studio";

const PLAN_AGENTS = [
  "writer",
  "director",
  "character",
  "cinematographer",
  "storyboard",
] as const;

export async function registerE2EUser(request: APIRequestContext) {
  const apiBase = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";
  const email = `e2e_drama_prod_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}@test.local`;
  const register = await request.post(`${apiBase}/api/v1/auth/register`, {
    data: { email, password: "testpass123" },
  });
  expect(register.ok()).toBeTruthy();
  const body = (await register.json()) as { data?: { token?: string } };
  const token = body.data?.token;
  expect(token).toBeTruthy();
  return { apiBase, token: token! };
}

export async function planAndLockCharacters(
  page: Page,
  request: APIRequestContext,
  token: string,
  apiBase: string,
) {
  await skipStudioCoach(page);
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate((t) => {
    localStorage.setItem("aimarket_token", t);
  }, token);

  await page.goto("/studio?mode=production", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/sessionId=/, { timeout: 30_000 });
  const station = studioWorkstation(page);
  await expect(station.locator("textarea").first()).toBeVisible({
    timeout: 15_000,
  });

  const idea =
    "都市爱情短剧：咖啡店老板与常客在雨夜重逢，三分钟讲完误会与和解";
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
  const planJson = (await planRes.json()) as {
    data?: { id?: string; status?: string };
  };
  const planId = planJson.data?.id;
  expect(planId).toBeTruthy();

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
    headers: { Authorization: `Bearer ${token}` },
  });
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
      { timeout: 60_000 },
    );
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

  const panelAfterLock = page.getByTestId("drama-studio-panel");
  const produceResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/produce") &&
      res.request().method() === "POST" &&
      res.ok(),
    { timeout: 60_000 },
  );
  await panelAfterLock.getByTestId("drama-confirm-produce").click();
  const produceRes = await produceResponse;
  const produceJson = (await produceRes.json()) as {
    data?: { id?: string; status?: string };
  };
  const runId = produceJson.data?.id;
  expect(runId).toBeTruthy();

  return { apiBase, token, projectId: projectId!, runId: runId! };
}
