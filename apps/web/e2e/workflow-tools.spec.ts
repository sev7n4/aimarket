import { test, expect } from "@playwright/test";
import { gotoWorkflowAndWait, studioWorkstation } from "./helpers/studio";

const API_BASE = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";

async function skipCoach(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem("aimarket_studio_coach_v2", "1");
    localStorage.setItem("aimarket_studio_mobile_coach_v1", "1");
    localStorage.setItem("aimarket_canvas_flow", "1");
  });
}

/** 注册并 ensure 会话，避免 workflow 壳在 readOnly 下无法落节点 */
async function prepareWorkflowSession(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
) {
  await skipCoach(page);
  const email = `wf_tools_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@test.local`;
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
    data: { sessionId, mode: "chat", kind: "canvas", title: "workflow-tools-e2e" },
  });
  expect(ensure.ok(), `ensure failed: ${await ensure.text()}`).toBeTruthy();

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate((t) => {
    localStorage.setItem("aimarket_token", t);
  }, token!);

  await gotoWorkflowAndWait(page, `/workflow?sessionId=${sessionId}`);
  return { sessionId, token: token! };
}

test.describe("Workflow tools (Phase 4)", () => {
  test.setTimeout(120_000);

  test("调色板添加文生图节点", async ({ page, request }) => {
    await prepareWorkflowSession(page, request);

    await page.getByTestId("workflow-tool-TEXT_TO_IMAGE").click();
    await expect(page.locator('[data-node-id^="wf-text_to_image-"]')).toHaveCount(1, {
      timeout: 15_000,
    });
    await expect(page.getByTestId(/^workflow-node-content-/)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("文生图节点运行触发 story-canvas generate-image", async ({ page, request }) => {
    await prepareWorkflowSession(page, request);

    await page.getByTestId("workflow-tool-TEXT_TO_IMAGE").click();
    const runBtn = page.locator('[data-testid^="workflow-node-run-"]').first();
    await expect(runBtn).toBeVisible({ timeout: 15_000 });

    const generatePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/story-canvas/generate-image") &&
        res.request().method() === "POST",
      { timeout: 30_000 },
    );

    // WorkflowTopBar shortens the canvas; Playwright scroll-into-view can land
    // the run button under the fixed minimap overlay.
    await runBtn.click({ force: true });
    const res = await generatePromise;
    expect(res.ok(), `generate-image failed: ${await res.text()}`).toBeTruthy();
  });

  test("扩图节点无上游连接时提示错误", async ({ page, request }) => {
    await prepareWorkflowSession(page, request);

    await page.getByTestId("workflow-tool-IMAGE_OUTPAINTING").click();
    const runBtn = page.locator('[data-testid^="workflow-node-run-"]').first();
    await expect(runBtn).toBeVisible({ timeout: 15_000 });
    await runBtn.click({ force: true });

    await expect(page.getByText("请先连接上游图片节点")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Agent 历史 Tab 可切换", async ({ page, request }) => {
    await prepareWorkflowSession(page, request);

    await page.getByRole("button", { name: "历史" }).click();
    await expect(page.getByText("暂无历史对话")).toBeVisible({ timeout: 10_000 });
  });

  test("工作流壳展示分享与模板入口", async ({ page, request }) => {
    await prepareWorkflowSession(page, request);

    await expect(page.getByTestId("workflow-share-toggle")).toBeVisible();
    await expect(page.getByTestId("template-manager-toggle")).toBeVisible();
    await expect(studioWorkstation(page)).toBeHidden({ timeout: 5_000 });
  });
});
