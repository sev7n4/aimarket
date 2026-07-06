import { test, expect } from "@playwright/test";
import { registerViaEmail } from "./helpers/auth";
import {
  enterInfiniteNodeView,
  gotoStudioAndWait,
  studioWorkstation,
} from "./helpers/studio";

/**
 * Phase 5 生产路径 smoke 验证。
 *
 * Infinite 模式下隐藏全局 StudioDock，空画布提供画布级创作入口。
 *
 * 验证：
 * - 切「节点视图」→ 空画布创作台 → 生成节点
 * - 选中节点出现节点创作台与工具链
 * - 节点右键弹出工具菜单
 * - 模板/音乐浮动入口存在
 */

const PROMPT = "白底极简产品图，节点画布生产路径 smoke 测试";

async function skipCoachKeepCanvasFlow(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem("aimarket_studio_coach_v2", "1");
    localStorage.setItem("aimarket_studio_mobile_coach_v1", "1");
    localStorage.setItem("aimarket_studio_dock_mode_v1", "expanded");
  });
}

/** Infinite 空画布创作入口生成，或 Scroll 预生成后切节点视图 */
async function generateInInfiniteNodeView(page: import("@playwright/test").Page) {
  await enterInfiniteNodeView(page);
  await expect(studioWorkstation(page)).toBeHidden({ timeout: 5_000 });

  const emptyPrompt = page.getByTestId("infinite-canvas-empty-prompt");
  if (await emptyPrompt.isVisible().catch(() => false)) {
    await emptyPrompt.getByTestId("infinite-empty-prompt-input").fill(PROMPT);
    await emptyPrompt.getByTestId("infinite-empty-submit").click();
  } else {
    const station = studioWorkstation(page);
    await station.locator("textarea").first().fill(PROMPT);
    await station.getByRole("button", { name: "开始生成" }).click();
    await expect(page.locator('[data-testid^="canvas-item-"]').first()).toBeVisible({
      timeout: 180_000,
    });
    await enterInfiniteNodeView(page);
  }

  const firstNode = page.locator("[data-node-id]").first();
  await expect(firstNode).toBeVisible({ timeout: 180_000 });
  return firstNode;
}

test.describe("InfiniteCanvas 生产路径", () => {
  test.setTimeout(240_000);

  test("切到节点视图后走 InfiniteCanvas 路径", async ({ page }) => {
    await skipCoachKeepCanvasFlow(page);
    await registerViaEmail(page, { emailPrefix: "prodcv" });
    await gotoStudioAndWait(page, "/studio");

    const firstNode = await generateInInfiniteNodeView(page);

    await firstNode.click();
    const nodeDock = page.getByTestId("infinite-node-studio-dock");
    await expect(nodeDock).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("infinite-node-toolchain")).toBeVisible();

    await firstNode.click({ button: "right" });
    const menu = page.locator('[data-testid="infinite-canvas-context-menu"]');
    await expect(menu).toBeVisible({ timeout: 5_000 });
    await expect(menu).toContainText(/抠图|扩图|重生成|删除/);
    await expect(menu).toContainText(/多机位 9 宫格/);
    await expect(menu).toContainText(/剧情推演四宫格/);
    await expect(menu).toContainText(/360° 角度呈现/);
    await expect(menu).toContainText(/灯光控制/);

    await page.mouse.click(20, 20);
    await expect(menu).toBeHidden({ timeout: 5_000 });

    await expect(page.getByTestId("template-manager-toggle")).toBeVisible();
    await expect(page.getByTestId("music-gen-toggle")).toBeVisible();

    await page.getByTestId("template-manager-toggle").click();
    const templatePanel = page.getByTestId("template-manager-panel");
    await expect(templatePanel).toBeVisible({ timeout: 5_000 });
    await expect(templatePanel).toContainText(/短剧标准流程|MV 制作|TVC/);
  });

  test("关闭右键菜单后再次打开可用", async ({ page }) => {
    await skipCoachKeepCanvasFlow(page);
    await registerViaEmail(page, { emailPrefix: "prodcv2" });
    await gotoStudioAndWait(page, "/studio");

    const firstNode = await generateInInfiniteNodeView(page);

    await firstNode.click({ button: "right" });
    const menu = page.locator('[data-testid="infinite-canvas-context-menu"]');
    await expect(menu).toBeVisible({ timeout: 5_000 });

    await page.mouse.click(20, 20);
    await expect(menu).toBeHidden({ timeout: 5_000 });

    await firstNode.click({ button: "right" });
    await expect(menu).toBeVisible({ timeout: 5_000 });
  });
});
