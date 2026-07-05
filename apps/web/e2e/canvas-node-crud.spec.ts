import { expect, test } from "@playwright/test";

const API_BASE = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";

async function prepareInfiniteCanvasStudio(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
) {
  await page.addInitScript(() => {
    localStorage.setItem("aimarket_studio_coach_v2", "1");
    localStorage.setItem("aimarket_studio_mobile_coach_v1", "1");
    localStorage.setItem("aimarket_studio_dock_mode_v1", "expanded");
  });
  const email = `e2e_node_crud_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}@test.local`;
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
    data: { sessionId, mode: "chat", kind: "canvas", title: "node-crud-e2e" },
  });
  expect(ensure.ok(), `ensure failed: ${await ensure.text()}`).toBeTruthy();

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate((t) => {
    localStorage.setItem("aimarket_token", t);
  }, token!);
  await page.goto(`/studio?sessionId=${sessionId}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page).toHaveURL(/sessionId=/, { timeout: 30_000 });
  // 统一默认 ScrollCanvas：先切到「节点视图」进入 InfiniteCanvas
  const viewToggle = page.getByTestId("drama-view-phase-toggle");
  await expect(viewToggle).toBeVisible({ timeout: 15_000 });
  await viewToggle.click();
  await expect(page.getByTestId("infinite-canvas-pane")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId("node-create-toggle")).toBeVisible({
    timeout: 15_000,
  });

  return { sessionId, token: token! };
}

async function createTextNodeAtPane(
  page: import("@playwright/test").Page,
  pane: ReturnType<typeof page.getByTestId>,
  position: { x: number; y: number },
) {
  await pane.click({ button: "right", position });
  await expect(page.getByTestId("node-create-menu")).toBeVisible({
    timeout: 10_000,
  });
  await page.getByTestId("node-create-text").click();
  const textNode = page.locator('[data-node-id^="text-"]').last();
  await expect(textNode).toBeVisible({ timeout: 10_000 });
  return textNode;
}

async function createDownstreamFromSource(
  page: import("@playwright/test").Page,
  source: ReturnType<typeof page.locator>,
  nodeType: "config" | "text",
) {
  await source.hover();
  await page.getByTestId("connection-create-toggle").first().click();
  await expect(page.getByTestId("connection-create-menu")).toBeVisible();
  await page.getByTestId(`connection-create-${nodeType}`).click();
  await expect(
    page.locator(`[data-node-id^="${nodeType}-"]`).last(),
  ).toBeVisible({ timeout: 10_000 });
}

test.describe("canvas node crud (InfiniteCanvas)", () => {
  test("空白右键添加 text → 删除 → 端口+下游 Config → 删连线", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    await prepareInfiniteCanvasStudio(page, request);
    const pane = page.getByTestId("infinite-canvas-pane");

    await createTextNodeAtPane(page, pane, { x: 240, y: 200 });

    const textNode = page.locator('[data-node-id^="text-"]').first();
    await textNode.click();
    await page.keyboard.press("Delete");
    await expect(page.locator('[data-node-id^="text-"]')).toHaveCount(0);

    await pane.dblclick({ position: { x: 300, y: 240 } });
    await expect(page.getByTestId("node-create-menu")).toBeVisible();
    await page.getByTestId("node-create-text").click();
    await expect(page.locator('[data-node-id^="text-"]')).toBeVisible();

    const source = page.locator('[data-node-id^="text-"]').first();
    await createDownstreamFromSource(page, source, "config");

    await expect(page.locator("[data-connection-id]")).toHaveCount(1, {
      timeout: 10_000,
    });
    const connection = page.locator("[data-connection-id]").first();
    await connection.click({ button: "right", force: true });
    await expect(page.getByTestId("connection-context-menu")).toBeVisible();
    await page.getByTestId("connection-context-delete").click();
    await expect(page.locator("[data-connection-id]")).toHaveCount(0);

    await page.waitForTimeout(1200);

    const sessionId = new URL(page.url()).searchParams.get("sessionId");
    expect(sessionId).toBeTruthy();
    const token = await page.evaluate(() =>
      localStorage.getItem("aimarket_token"),
    );
    expect(token).toBeTruthy();
    const layoutRes = await request.get(
      `${API_BASE}/api/v1/imageSession/${sessionId}/canvas`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(layoutRes.ok(), `layout GET failed: ${await layoutRes.text()}`).toBeTruthy();
    const layout = (await layoutRes.json()) as {
      data?: { infiniteConnections?: unknown[] };
    };
    expect(layout.data?.infiniteConnections ?? []).toHaveLength(0);

    const flowRes = await request.get(
      `${API_BASE}/api/v1/imageSession/${sessionId}/canvas-flow`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(flowRes.ok()).toBeTruthy();
    const flowBody = (await flowRes.json()) as {
      data?: { edges?: Array<{ kind?: string }> };
    };
    const triggerEdges = (flowBody.data?.edges ?? []).filter(
      (e) => e.kind === "trigger",
    );
    expect(triggerEdges).toHaveLength(0);
  });

  test("一对多分支：源 text 端口+两个下游 → 删一条分支连线", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const { sessionId } = await prepareInfiniteCanvasStudio(page, request);
    const pane = page.getByTestId("infinite-canvas-pane");

    const source = await createTextNodeAtPane(page, pane, { x: 200, y: 180 });
    const sourceId = await source.getAttribute("data-node-id");
    expect(sourceId).toBeTruthy();

    await createDownstreamFromSource(page, source, "config");
    await createDownstreamFromSource(page, source, "text");

    await expect(page.locator('[data-node-id^="config-"]')).toHaveCount(1);
    await expect(page.locator('[data-node-id^="text-"]')).toHaveCount(2);
    await expect(page.locator("[data-connection-id]")).toHaveCount(2, {
      timeout: 10_000,
    });

    const firstConnection = page.locator("[data-connection-id]").first();
    await firstConnection.click({ button: "right", force: true });
    await expect(page.getByTestId("connection-context-menu")).toBeVisible();
    await page.getByTestId("connection-context-delete").click();
    await expect(page.locator("[data-connection-id]")).toHaveCount(1);

    await page.waitForTimeout(1200);

    const token = await page.evaluate(() =>
      localStorage.getItem("aimarket_token"),
    );
    const layoutRes = await request.get(
      `${API_BASE}/api/v1/imageSession/${sessionId}/canvas`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(layoutRes.ok(), `layout GET failed: ${await layoutRes.text()}`).toBeTruthy();
    const layout = (await layoutRes.json()) as {
      data?: {
        infiniteConnections?: Array<{
          fromNodeId: string;
          toNodeId: string;
        }>;
      };
    };
    const connections = layout.data?.infiniteConnections ?? [];
    expect(connections).toHaveLength(1);
    expect(connections[0]?.fromNodeId).toBe(sourceId);
  });
});
