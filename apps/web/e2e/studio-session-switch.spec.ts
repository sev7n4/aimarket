import { expect, test, type Page } from "@playwright/test";
import { skipStudioCoach, studioWorkstation } from "./helpers/studio";

const MOCK_WORKSPACE_ID = "ws-switch-personal";

const SESSION_A = {
  id: "sess-switch-a",
  title: "画布 Alpha",
  mode: "chat",
  kind: "canvas",
  can_edit: true,
  created_at: "2024-06-02T00:00:00.000Z",
  updated_at: "2024-06-03T00:00:00.000Z",
};

const SESSION_B = {
  id: "sess-switch-b",
  title: "画布 Beta",
  mode: "chat",
  kind: "canvas",
  can_edit: true,
  created_at: "2024-06-01T00:00:00.000Z",
  updated_at: "2024-06-02T00:00:00.000Z",
};

async function mockStudioSessionSwitch(page: Page) {
  await skipStudioCoach(page);
  await page.addInitScript(
    ({ workspaceId, userId }) => {
      localStorage.setItem("aimarket_token", "e2e-session-switch-token");
      localStorage.setItem("aimarket_studio_dock_mode_v1", "expanded");
      localStorage.setItem("aimarket_active_workspace_id", workspaceId);
      localStorage.setItem(`aimarket_drama_coach_v1:${userId}`, "1");
    },
    { workspaceId: MOCK_WORKSPACE_ID, userId: "switch-user-1" },
  );

  await page.route("**/api/v1/user/getInfo", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: "switch-user-1",
          email: "switch-user@example.test",
          credits: 100,
          created_at: "2024-01-01T00:00:00.000Z",
        },
      }),
    }),
  );

  await page.route("**/api/v1/workspaces/list", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: MOCK_WORKSPACE_ID,
            name: "个人空间",
            is_personal: 1,
            role: "owner",
            created_at: "2024-01-01T00:00:00.000Z",
          },
        ],
      }),
    }),
  );

  await page.route("**/api/v1/imageSession/list**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [SESSION_A, SESSION_B] }),
    }),
  );

  await page.route("**/api/v1/tools/list", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: [] }) }),
  );

  await page.route("**/api/v1/agent/skills", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: [] }) }),
  );

  await page.route("**/api/v1/agent/plan", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: { steps: [] } }),
    }),
  );

  await page.route("**/api/v1/events", (route) => route.fulfill({ status: 204, body: "" }));

  await page.route("**/api/v1/drama/sessions/*/state", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: {} }),
    }),
  );

  for (const session of [SESSION_A, SESSION_B]) {
    await page.route(`**/api/v1/imageSession/${session.id}`, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            ...session,
            can_edit: true,
          },
        }),
      }),
    );

    await page.route(`**/api/v1/canvas/${session.id}/bundle`, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            layout: {
              version: 1,
              items: [
                {
                  id: `item-${session.id}`,
                  url: `/mock/${session.id}.png`,
                  x: 0,
                  y: 0,
                  width: 512,
                  height: 512,
                  label: session.title,
                  batchId: `batch-${session.id}`,
                  batchIndex: 0,
                },
              ],
            },
            messages: [],
            meta: { can_edit: true },
          },
        }),
      }),
    );
  }
}

async function waitForSidebarSessions(page: Page) {
  const station = studioWorkstation(page);
  await expect(station.locator("textarea").first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId(`studio-session-row-${SESSION_A.id}`)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId(`studio-session-row-${SESSION_B.id}`)).toBeVisible({
    timeout: 15_000,
  });
  return station;
}

test.describe("studio session switch", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("侧栏切换画布更新 URL 与标题", async ({ page }) => {
    await mockStudioSessionSwitch(page);
    await page.goto(
      `/studio?sessionId=${encodeURIComponent(SESSION_A.id)}&mode=chat`,
      { waitUntil: "domcontentloaded" },
    );

    await expect(page).toHaveURL(
      new RegExp(`sessionId=${SESSION_A.id.replace(/-/g, "\\-")}`),
    );

    await waitForSidebarSessions(page);

    await page.getByTestId(`studio-session-row-${SESSION_B.id}`).click();
    await expect(page).toHaveURL(
      new RegExp(`sessionId=${SESSION_B.id.replace(/-/g, "\\-")}`),
    );

    await page.getByTestId(`studio-session-row-${SESSION_A.id}`).click();
    await expect(page).toHaveURL(
      new RegExp(`sessionId=${SESSION_A.id.replace(/-/g, "\\-")}`),
    );
  });

  test("Agent 车道切换会话后保持创作方式", async ({ page }) => {
    await mockStudioSessionSwitch(page);
    await page.addInitScript(() => {
      localStorage.setItem("aimarket.studio.lane", "agent");
      localStorage.removeItem("aimarket.studio.laneDrafts");
    });

    await page.goto(
      `/studio?sessionId=${encodeURIComponent(SESSION_A.id)}&mode=chat`,
      { waitUntil: "domcontentloaded" },
    );

    const station = await waitForSidebarSessions(page);
    const lanePicker = station.getByRole("button", { name: "选择创作方式" });
    await expect(lanePicker).toContainText("Agent 模式", { timeout: 15_000 });

    const betaHref = await page
      .getByTestId(`studio-session-row-${SESSION_B.id}`)
      .getAttribute("href");
    expect(betaHref).toContain(SESSION_B.id);
    await page.goto(betaHref!, { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(
      new RegExp(`sessionId=${SESSION_B.id.replace(/-/g, "\\-")}`),
      { timeout: 15_000 },
    );
    await expect(
      studioWorkstation(page).getByRole("button", { name: "选择创作方式" }),
    ).toContainText("Agent 模式", { timeout: 15_000 });

    const alphaHref = await page
      .getByTestId(`studio-session-row-${SESSION_A.id}`)
      .getAttribute("href");
    expect(alphaHref).toContain(SESSION_A.id);
    await page.goto(alphaHref!, { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(
      new RegExp(`sessionId=${SESSION_A.id.replace(/-/g, "\\-")}`),
      { timeout: 15_000 },
    );
    await expect(
      studioWorkstation(page).getByRole("button", { name: "选择创作方式" }),
    ).toContainText("Agent 模式", { timeout: 15_000 });
  });

  test("Agent 车道有 prompt 时切换会话清空输入并展示目标画布", async ({
    page,
  }) => {
    await mockStudioSessionSwitch(page);
    await page.addInitScript(() => {
      localStorage.setItem("aimarket.studio.lane", "agent");
      localStorage.removeItem("aimarket.studio.laneDrafts");
    });

    await page.goto(
      `/studio?sessionId=${encodeURIComponent(SESSION_A.id)}&mode=chat`,
      { waitUntil: "domcontentloaded" },
    );

    const station = await waitForSidebarSessions(page);
    await expect(
      page.getByTestId(`canvas-item-item-${SESSION_A.id}`),
    ).toBeVisible({ timeout: 15_000 });

    const textarea = station.locator("textarea").first();
    await textarea.fill("旧会话 Agent 提示词，切换后不应残留");
    await expect(textarea).toHaveValue(/旧会话 Agent/);

    await page.getByTestId(`studio-session-row-${SESSION_B.id}`).click();
    await expect(page).toHaveURL(
      new RegExp(`sessionId=${SESSION_B.id.replace(/-/g, "\\-")}`),
      { timeout: 15_000 },
    );

    await expect(station.locator("textarea").first()).toHaveValue("", {
      timeout: 15_000,
    });
    await expect(
      page.getByTestId(`canvas-item-item-${SESSION_B.id}`),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("orchestration-timeline-section")).toHaveCount(
      0,
    );
  });
});
