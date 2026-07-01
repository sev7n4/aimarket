import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * 启用节点式画布模式（InfiniteCanvas 路径）。
 * 默认情况下，`skipStudioCoach` 会强制 `aimarket_canvas_flow=0`（旧 ScrollCanvas），
 * InfiniteCanvas 相关 E2E 用例需调用本 helper 来开启新流程。
 *
 * 同时设 localStorage 和 URL 参数 (?canvasFlow=1) 双重保险，
 * 避免 useState 初始 false → useEffect 同步造成的等待窗口期。
 */
export async function enableCanvasFlow(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("aimarket_studio_coach_v2", "1");
    localStorage.setItem("aimarket_studio_mobile_coach_v1", "1");
    localStorage.setItem("aimarket_studio_dock_mode_v1", "expanded");
    localStorage.setItem("aimarket_canvas_flow", "1");
  });
}

/** 跳转到带 ?canvasFlow=1 的 studio，等同于开启节点式画布 */
export async function gotoStudioWithCanvasFlow(
  page: Page,
  url = "/studio",
) {
  const u = new URL(url, "http://placeholder.local");
  u.searchParams.set("canvasFlow", "1");
  await page.goto(u.pathname + u.search, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/sessionId=/, { timeout: 30_000 });
}

/** 节点式画布内任一节点（通过 data-node-id 定位） */
export function infiniteNodeById(page: Page, nodeId: string) {
  return page.locator(`[data-node-id="${nodeId}"]`);
}

/** 节点式画布第一个可见节点 */
export function firstInfiniteNode(page: Page) {
  return page.locator("[data-node-id]").first();
}

/** 节点式画布右键菜单 */
export function infiniteContextMenu(page: Page) {
  return page.locator('[data-testid="infinite-canvas-context-menu"]');
}

/** 节点式画布浮动入口：模板/音乐 */
export function templateManagerToggle(page: Page) {
  return page.getByTestId("template-manager-toggle");
}

export function musicGenToggle(page: Page) {
  return page.getByTestId("music-gen-toggle");
}

export function templateManagerPanel(page: Page) {
  return page.locator('[data-testid="template-manager-panel"]');
}

export function musicGenPanel(page: Page) {
  return page.locator('[data-testid="music-gen-panel"]');
}

/** 等待节点式画布首次出现至少一个节点 */
export async function waitForFirstNode(page: Page, timeoutMs = 60_000) {
  const first = page.locator("[data-node-id]").first();
  await expect(first).toBeVisible({ timeout: timeoutMs });
  return first;
}

/** 通过 DOM 抓取画布上所有节点 id */
export async function listNodeIds(page: Page): Promise<string[]> {
  return page.$$eval("[data-node-id]", (els) =>
    els.map((e) => (e as HTMLElement).dataset.nodeId || "").filter(Boolean),
  );
}

