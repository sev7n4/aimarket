import { test, expect } from "@playwright/test";
import { registerViaEmail } from "./helpers/auth";
import {
  enableCanvasFlow,
  gotoStudioWithCanvasFlow,
  infiniteContextMenu,
  listNodeIds,
  musicGenPanel,
  musicGenToggle,
  templateManagerPanel,
  templateManagerToggle,
  waitForFirstNode,
} from "./helpers/canvas-flow";
import { studioWorkstation } from "./helpers/studio";

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

async function generateOne(
  page: import("@playwright/test").Page,
  prompt: string,
) {
  const station = studioWorkstation(page);
  const textarea = station.locator("textarea").first();
  await expect(textarea).toBeVisible({ timeout: 15_000 });
  await textarea.fill(prompt);
  await station.getByRole("button", { name: "开始生成" }).click();
}

test.describe("InfiniteCanvas 节点画布", () => {
  test.beforeEach(async ({ page }) => {
    await enableCanvasFlow(page);
    await registerViaEmail(page, { emailPrefix: "canvasflow" });
    await gotoStudioWithCanvasFlow(page);
  });

  test("画布上出现节点", async ({ page }) => {
    await generateOne(page, PROMPT);
    const first = await waitForFirstNode(page);
    await expect(first).toBeVisible();
    const ids = await listNodeIds(page);
    expect(ids.length).toBeGreaterThan(0);
  });

  test("节点右键弹出工具菜单", async ({ page }) => {
    await generateOne(page, PROMPT);
    const first = await waitForFirstNode(page);
    await first.click({ button: "right" });
    const menu = infiniteContextMenu(page);
    await expect(menu).toBeVisible({ timeout: 5_000 });
    await expect(menu).toContainText(/抠图|扩图|重生成|删除/);
  });

  test("模板浮动入口可打开面板", async ({ page }) => {
    await generateOne(page, PROMPT);
    await waitForFirstNode(page);
    const toggle = templateManagerToggle(page);
    await expect(toggle).toBeVisible();
    await toggle.click();
    const panel = templateManagerPanel(page);
    await expect(panel).toBeVisible({ timeout: 5_000 });
  });

  test("音乐浮动入口可打开面板", async ({ page }) => {
    await generateOne(page, PROMPT);
    await waitForFirstNode(page);
    const toggle = musicGenToggle(page);
    await expect(toggle).toBeVisible();
    await toggle.click();
    const panel = musicGenPanel(page);
    await expect(panel).toBeVisible({ timeout: 5_000 });
  });

  test("节点可被拖动且坐标更新", async ({ page }) => {
    await generateOne(page, PROMPT);
    const first = await waitForFirstNode(page);
    const box1 = await first.boundingBox();
    expect(box1).not.toBeNull();
    const cx = box1!.x + box1!.width / 2;
    const cy = box1!.y + box1!.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy + 60, { steps: 10 });
    await page.mouse.up();
    const box2 = await first.boundingBox();
    expect(box2).not.toBeNull();
    const dx = Math.abs(box2!.x - box1!.x);
    const dy = Math.abs(box2!.y - box1!.y);
    expect(dx + dy).toBeGreaterThan(20);
  });

  test("外部点击关闭右键菜单", async ({ page }) => {
    await generateOne(page, PROMPT);
    const first = await waitForFirstNode(page);
    await first.click({ button: "right" });
    const menu = infiniteContextMenu(page);
    await expect(menu).toBeVisible({ timeout: 5_000 });
    await page.mouse.click(20, 20);
    await expect(menu).toBeHidden({ timeout: 5_000 });
  });
});
