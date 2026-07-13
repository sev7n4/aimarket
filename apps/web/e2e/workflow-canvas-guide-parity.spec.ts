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
  const email = `wf_parity_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@test.local`;
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
    data: { sessionId, mode: "chat", kind: "canvas", title: "workflow-canvas-guide-parity-e2e" },
  });
  expect(ensure.ok(), `ensure failed: ${await ensure.text()}`).toBeTruthy();

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate((t) => {
    localStorage.setItem("aimarket_token", t);
  }, token!);

  await gotoWorkflowAndWait(page, `/workflow?sessionId=${sessionId}`);
}

test.describe("Workflow canvas guide parity (C1–C4 smoke)", () => {
  test.setTimeout(60_000);

  test("指南胶囊章节齐全", async ({ page, request }) => {
    await prepareWorkflowSession(page, request);

    await page.getByTestId("canvas-guide-toggle").click();
    const panel = page.getByTestId("canvas-guide-panel");
    await expect(panel).toBeVisible();

    await expect(panel.getByText("一、画布导航")).toBeVisible();
    await expect(panel.getByText("二、基础操作")).toBeVisible();
    await expect(panel.getByText("三、高级功能")).toBeVisible();
    await expect(panel.getByText("四、资产管理")).toBeVisible();
  });

  test("适应视图与 chrome 开关可见", async ({ page, request }) => {
    await prepareWorkflowSession(page, request);

    await expect(page.getByTestId("canvas-reset-view")).toBeVisible();
    await expect(page.getByTestId("canvas-toggle-grid")).toBeVisible();
    await expect(page.getByTestId("canvas-toggle-snap")).toBeVisible();
    await expect(page.getByTestId("canvas-toggle-edge-anim")).toBeVisible();
    await expect(page.getByTestId("canvas-toggle-lock-view")).toBeVisible();
    await expect(page.getByTestId("canvas-minimap")).toBeVisible();
  });

  test("顶栏 Run All 可见", async ({ page, request }) => {
    await prepareWorkflowSession(page, request);

    await expect(page.getByTestId("workflow-top-bar")).toBeVisible();
    await expect(page.getByTestId("workflow-run-all")).toBeVisible();
    await expect(page.getByTestId("workflow-back")).toBeVisible();
  });

  test("资产面板可打开", async ({ page, request }) => {
    await prepareWorkflowSession(page, request);

    await expect(page.getByTestId("workflow-left-panel")).toBeVisible();
    await page.getByTestId("workflow-left-tab-assets").click();
    await expect(page.getByTestId("asset-panel")).toBeVisible();
  });
});
