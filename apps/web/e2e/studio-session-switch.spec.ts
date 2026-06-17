import { expect, test, type Page } from "@playwright/test";
import { skipStudioCoach } from "./helpers/studio";

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
  await page.addInitScript(() => {
    localStorage.setItem("aimarket_token", "e2e-session-switch-token");
    localStorage.setItem("aimarket_studio_dock_mode_v1", "expanded");
  });

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
    await expect(page.getByText("画布 Alpha", { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("link", { name: /画布 Beta/ }).click();

    await expect(page).toHaveURL(
      new RegExp(`sessionId=${SESSION_B.id.replace(/-/g, "\\-")}`),
    );
    await expect(page.getByText("画布 Beta", { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("link", { name: /画布 Alpha/ }).click();
    await expect(page).toHaveURL(
      new RegExp(`sessionId=${SESSION_A.id.replace(/-/g, "\\-")}`),
    );
  });
});
