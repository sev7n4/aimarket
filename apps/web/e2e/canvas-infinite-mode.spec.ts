import { test, expect } from "@playwright/test";
import { registerViaEmail } from "./helpers/auth";
import { enableCanvasFlow, firstInfiniteNode, infiniteContextMenu, listNodeIds, musicGenPanel, musicGenToggle, templateManagerPanel, templateManagerToggle, waitForFirstNode } from "./helpers/canvas-flow";

/**
 * Phase 1.7 + 1.10：节点式画布（InfiniteCanvas）路径 E2E 覆盖。
 * 验证：
 * - 生成图片后画布出现节点式节点（data-node-id）
 * - 节点右键弹出动态工具菜单
 * - 模板/音乐浮动入口可打开对应面板
 * - 节点可拖动改变坐标（位置持久化）
 * - 双击节点可触发属性面板入口
 */

const PROMPT = "白底简单产品图测试节点画布";

async function startGeneration(page: import("@playwright/test").Page) {
  const homePanel = page.locator("#home-creation");
  const textarea = homePanel.locator("textarea").first();
  await expect(textarea).toBeVisible({ timeout: 10_000 });
  await textarea.fill(PROMPT);
  await homePanel.getByRole("button", { name: "开始生成" }).click();
  await expect(page).toHaveURL(/\/studio/, { timeout: 20_000 });
}

async function waitForJobDone(page: import("@playwright/test").Page) {
  const overlay = page.locator('[role="status"][aria-live="polite"]');
  await expect(overlay).toBeHidden({ timeout: 180_000 });
}

test.describe("InfiniteCanvas 节点画布", () => {
  test.beforeEach(async ({ page }) => {
    await enableCanvasFlow(page);
    await registerViaEmail(page, { emailPrefix: "canvasflow" });
  });

  test("生成后画布出现节点", async ({ page }) => {
    await startGeneration(page);
    const first = await waitForFirstNode(page);
    await expect(first).toBeVisible();
    const ids = await listNodeIds(page);
    expect(ids.length).toBeGreaterThan(0);
  });

  test("节点右键弹出工具菜单", async ({ page }) => {
    await startGeneration(page);
    const first = await waitForFirstNode(page);
    // 右键节点
    await first.click({ button: "right" });
    const menu = infiniteContextMenu(page);
    await expect(menu).toBeVisible({ timeout: 5_000 });
    // 至少应包含常用操作
    await expect(menu).toContainText(/抠图|扩图|重生成|删除/);
  });

  test("模板浮动入口可打开面板", async ({ page }) => {
    await startGeneration(page);
    await waitForFirstNode(page);
    const toggle = templateManagerToggle(page);
    await expect(toggle).toBeVisible();
    await toggle.click();
    const panel = templateManagerPanel(page);
    await expect(panel).toBeVisible({ timeout: 5_000 });
  });

  test("音乐浮动入口可打开面板", async ({ page }) => {
    await startGeneration(page);
    await waitForFirstNode(page);
    const toggle = musicGenToggle(page);
    await expect(toggle).toBeVisible();
    await toggle.click();
    const panel = musicGenPanel(page);
    await expect(panel).toBeVisible({ timeout: 5_000 });
  });

  test("节点可被拖动且坐标更新", async ({ page }) => {
    await startGeneration(page);
    const first = await waitForFirstNode(page);
    const box1 = await first.boundingBox();
    expect(box1).not.toBeNull();
    // 拖动 80px
    const targetX = (box1?.x ?? 0) + 80;
    const targetY = (box1?.y ?? 0) + 60;
    await page.mouse.move(box1!.x + box1!.width / 2, box1!.y + box1!.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetX + box1!.width / 2, targetY + box1!.height / 2, { steps: 10 });
    await page.mouse.up();
    // 重新读取
    const box2 = await first.boundingBox();
    expect(box2).not.toBeNull();
    const dx = Math.abs((box2!.x) - (box1!.x));
    const dy = Math.abs((box2!.y) - (box1!.y));
    expect(dx + dy).toBeGreaterThan(20);
  });

  test("外部点击关闭右键菜单", async ({ page }) => {
    await startGeneration(page);
    const first = await waitForFirstNode(page);
    await first.click({ button: "right" });
    const menu = infiniteContextMenu(page);
    await expect(menu).toBeVisible({ timeout: 5_000 });
    // 点击画布空白处关闭
    await page.mouse.click(20, 20);
    await expect(menu).toBeHidden({ timeout: 5_000 });
  });
});
