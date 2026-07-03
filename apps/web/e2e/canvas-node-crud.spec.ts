import { expect, test } from "@playwright/test";
import { registerViaEmail } from "./helpers/auth";

const API_BASE = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";

async function prepareInfiniteCanvasStudio(
  page: import("@playwright/test").Page,
) {
  await page.addInitScript(() => {
    localStorage.setItem("aimarket_studio_coach_v2", "1");
    localStorage.setItem("aimarket_studio_mobile_coach_v1", "1");
    localStorage.setItem("aimarket_studio_dock_mode_v1", "expanded");
  });
  await registerViaEmail(page, { emailPrefix: "e2e_node_crud" });
  await page.goto("/studio", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/sessionId=/, { timeout: 30_000 });
  await expect(page.getByTestId("node-create-toggle")).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("canvas node crud (InfiniteCanvas)", () => {
  test("空白右键添加 text → 删除 → 端口+下游 Config → 删连线", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    await prepareInfiniteCanvasStudio(page);
    const pane = page.getByTestId("infinite-canvas-pane");

    await pane.click({ button: "right", position: { x: 240, y: 200 } });
    await expect(page.getByTestId("node-create-menu")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("node-create-text").click();
    const textNode = page.locator('[data-node-id^="text-"]').first();
    await expect(textNode).toBeVisible({ timeout: 10_000 });

    await textNode.click();
    await page.keyboard.press("Delete");
    await expect(page.locator('[data-node-id^="text-"]')).toHaveCount(0);

    await pane.dblclick({ position: { x: 300, y: 240 } });
    await expect(page.getByTestId("node-create-menu")).toBeVisible();
    await page.getByTestId("node-create-text").click();
    await expect(page.locator('[data-node-id^="text-"]')).toBeVisible();

    const source = page.locator('[data-node-id^="text-"]').first();
    await source.hover();
    await page.getByTestId("connection-create-toggle").first().click();
    await expect(page.getByTestId("connection-create-menu")).toBeVisible();
    await page.getByTestId("connection-create-config").click();
    await expect(page.locator('[data-node-id^="config-"]')).toBeVisible({
      timeout: 10_000,
    });

    const connection = page.locator("[data-connection-id]").first();
    await expect(page.locator("[data-connection-id]")).toHaveCount(1, {
      timeout: 10_000,
    });
    await connection.click({ button: "right", force: true });
    await expect(page.getByTestId("connection-context-menu")).toBeVisible();
    await page.getByTestId("connection-context-delete").click();
    await expect(page.locator("[data-connection-id]")).toHaveCount(0);

    // 等待 debounced canvas_layout 持久化
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
});
