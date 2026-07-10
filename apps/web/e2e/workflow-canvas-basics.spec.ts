import { test, expect } from "@playwright/test";
import { gotoWorkflowAndWait } from "./helpers/studio";

const API_BASE = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";

async function skipCoach(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem("aimarket_studio_coach_v2", "1");
    localStorage.setItem("aimarket_studio_mobile_coach_v1", "1");
    localStorage.setItem("aimarket_canvas_flow", "1");
  });
}

async function prepareWorkflowSession(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
) {
  await skipCoach(page);
  const email = `wf_basics_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@test.local`;
  const register = await request.post(`${API_BASE}/api/v1/auth/register`, {
    data: { email, password: "testpass123" },
  });
  expect(register.ok(), `register failed: ${await register.text()}`).toBeTruthy();
  const body = (await register.json()) as { data?: { token?: string } };
  const token = body.data?.token;
  expect(token).toBeTruthy();

  const sessionId = crypto.randomUUID();
  const ensure = await request.post(`${API_BASE}/api/v1/imageSession/ensure`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { sessionId, mode: "chat", kind: "canvas", title: "workflow-basics-e2e" },
  });
  expect(ensure.ok(), `ensure failed: ${await ensure.text()}`).toBeTruthy();

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate((t) => {
    localStorage.setItem("aimarket_token", t);
  }, token!);

  await gotoWorkflowAndWait(page, `/workflow?sessionId=${sessionId}`);
}

test.describe("Workflow canvas basics", () => {
  test.setTimeout(90_000);

  test("左下角使用指南胶囊可打开关闭", async ({ page, request }) => {
    await prepareWorkflowSession(page, request);

    const capsule = page.getByTestId("canvas-guide-capsule");
    await expect(capsule).toBeVisible({ timeout: 15_000 });
    await capsule.click();

    const dialog = page.getByTestId("canvas-guide-dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("canvas-guide-section-nav")).toBeVisible();
    await expect(page.getByTestId("canvas-guide-section-edit")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });

  test("适应视图按钮可见", async ({ page, request }) => {
    await prepareWorkflowSession(page, request);
    await expect(page.getByTestId("canvas-fit-view")).toBeVisible({
      timeout: 15_000,
    });
  });
});
