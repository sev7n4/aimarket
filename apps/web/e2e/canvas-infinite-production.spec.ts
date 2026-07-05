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
 * 统一模型：三车道默认 ScrollCanvas，用户切「节点视图」才进入 InfiniteCanvas。
 * 本测试模拟真实生产用户 (isCanvasFlowMode()=true)，显式切到节点视图后
 * 验证 InfiniteCanvas 的生产能力。
 *
 * 验证：
 * - 主页注册 → 进入 studio → 切「节点视图」
 * - 画布出现 InfiniteCanvas 节点 (data-node-id)
 * - 节点右键弹出工具菜单
 * - 模板/音乐浮动入口存在
 */

const PROMPT = "白底极简产品图，节点画布生产路径 smoke 测试";

/** 保留 coach 跳过但不关闭 canvasFlow（enterInfiniteNodeView 需要节点画布开启） */
async function skipCoachKeepCanvasFlow(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem("aimarket_studio_coach_v2", "1");
    localStorage.setItem("aimarket_studio_mobile_coach_v1", "1");
    localStorage.setItem("aimarket_studio_dock_mode_v1", "expanded");
  });
}

test.describe("InfiniteCanvas 生产路径", () => {
  test.setTimeout(240_000);

  test("切到节点视图后走 InfiniteCanvas 路径", async ({ page }) => {
    await skipCoachKeepCanvasFlow(page);
    // 真实新用户：localStorage 全空，isCanvasFlowMode() 默认 true
    await registerViaEmail(page, { emailPrefix: "prodcv" });

    // 显式跳转到 /studio；registerViaEmail 停在首页
    await gotoStudioAndWait(page, "/studio");
    // 统一默认 ScrollCanvas：切到「节点视图」进入 InfiniteCanvas
    await enterInfiniteNodeView(page);

    const station = studioWorkstation(page);
    const textarea = station.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 15_000 });
    await textarea.fill(PROMPT);
    await station.getByRole("button", { name: "开始生成" }).click();

    // 生产路径下画布走 InfiniteCanvas, 节点用 [data-node-id] 标识
    const firstNode = page.locator("[data-node-id]").first();
    await expect(firstNode).toBeVisible({ timeout: 180_000 });

    // 节点右键弹出工具菜单
    await firstNode.click({ button: "right" });
    const menu = page.locator('[data-testid="infinite-canvas-context-menu"]');
    await expect(menu).toBeVisible({ timeout: 5_000 });
    await expect(menu).toContainText(/抠图|扩图|重生成|删除/);
    // Phase 4 专业能力入口
    await expect(menu).toContainText(/多机位 9 宫格/);
    await expect(menu).toContainText(/剧情推演四宫格/);
    await expect(menu).toContainText(/360° 角度呈现/);
    await expect(menu).toContainText(/灯光控制/);

    // 关闭右键菜单后再点浮动入口
    await page.mouse.click(20, 20);
    await expect(menu).toBeHidden({ timeout: 5_000 });

    // 浮动入口存在
    await expect(page.getByTestId("template-manager-toggle")).toBeVisible();
    await expect(page.getByTestId("music-gen-toggle")).toBeVisible();

    // 模板管理面板可打开并展示预置模板
    await page.getByTestId("template-manager-toggle").click();
    const templatePanel = page.getByTestId("template-manager-panel");
    await expect(templatePanel).toBeVisible({ timeout: 5_000 });
    await expect(templatePanel).toContainText(/短剧标准流程|MV 制作|TVC/);
  });

  test("关闭右键菜单后再次打开可用", async ({ page }) => {
    await skipCoachKeepCanvasFlow(page);
    await registerViaEmail(page, { emailPrefix: "prodcv2" });
    await gotoStudioAndWait(page, "/studio");
    await enterInfiniteNodeView(page);

    const station = studioWorkstation(page);
    const textarea = station.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 15_000 });
    await textarea.fill("测试再次打开右键");
    await station.getByRole("button", { name: "开始生成" }).click();

    const firstNode = page.locator("[data-node-id]").first();
    await expect(firstNode).toBeVisible({ timeout: 180_000 });

    // 第一次打开
    await firstNode.click({ button: "right" });
    const menu = page.locator('[data-testid="infinite-canvas-context-menu"]');
    await expect(menu).toBeVisible({ timeout: 5_000 });

    // 外部点击关闭
    await page.mouse.click(20, 20);
    await expect(menu).toBeHidden({ timeout: 5_000 });

    // 第二次打开
    await firstNode.click({ button: "right" });
    await expect(menu).toBeVisible({ timeout: 5_000 });
  });
});
