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
  const email = `wf_canvas_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@test.local`;
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
    data: { sessionId, mode: "chat", kind: "canvas", title: "workflow-canvas-basics-e2e" },
  });
  expect(ensure.ok(), `ensure failed: ${await ensure.text()}`).toBeTruthy();

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate((t) => {
    localStorage.setItem("aimarket_token", t);
  }, token!);

  await gotoWorkflowAndWait(page, `/workflow?sessionId=${sessionId}`);
}

test.describe("Workflow canvas basics (C1 chrome)", () => {
  test.setTimeout(60_000);

  test("左下 chrome 开关可见且 L 切换吸附", async ({ page, request }) => {
    await prepareWorkflowSession(page, request);

    const snapToggle = page.getByTestId("canvas-toggle-snap");
    await expect(snapToggle).toBeVisible();
    await expect(page.getByTestId("canvas-toggle-grid")).toBeVisible();
    await expect(page.getByTestId("canvas-toggle-edge-anim")).toBeVisible();
    await expect(page.getByTestId("canvas-toggle-lock-view")).toBeVisible();
    await expect(page.getByTestId("canvas-guide-capsule")).toBeVisible();

    await expect(snapToggle).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("KeyL");
    await expect(snapToggle).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("KeyL");
    await expect(snapToggle).toHaveAttribute("aria-pressed", "false");
  });

  test("顶栏可见且全部运行按钮存在", async ({ page, request }) => {
    await prepareWorkflowSession(page, request);

    await expect(page.getByTestId("workflow-top-bar")).toBeVisible();
    await expect(page.getByTestId("workflow-run-all")).toBeVisible();
    await expect(page.getByTestId("workflow-back")).toBeVisible();
  });
});
