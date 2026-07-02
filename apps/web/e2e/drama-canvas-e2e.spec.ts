import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Phase 5.7.1: drama 节点在 InfiniteCanvas 生产路径下渲染 + DramaPropertyPanel 双击可打开。
 *
 * 注意:
 * - 不调用 skipStudioCoach, 以便 isCanvasFlowMode() 默认返回 true (生产路径)。
 * - 不调用 enableCanvasFlow() (helper 默认是 scroll 模式)。
 * - drama 节点来自 dramaPlanToCanvasNodes(dramaDraftProject.project), 因此 mock state 需带 draftProject。
 * - 故意 shots=[] 以避免 showShotTimeline 替换 InfiniteCanvas 主区。
 */

const API_BASE = process.env.E2E_API_URL ?? "http://127.0.0.1:4000";

async function registerAndEnsureSession(
  request: APIRequestContext,
  emailPrefix: string,
): Promise<{ token: string; sessionId: string }> {
  const email = `${emailPrefix}_${Date.now()}_${Math.random()
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
    data: { sessionId, mode: "chat", kind: "canvas", title: "drama-canvas-e2e" },
  });
  expect(ensure.ok(), `ensure failed: ${await ensure.text()}`).toBeTruthy();

  return { token: token!, sessionId };
}

function buildDramaDraftProject(sessionId: string) {
  return {
    id: `e2e-project-${sessionId}`,
    sessionId,
    userIdea: "都市爱情短剧：咖啡店老板与常客在雨夜重逢",
    status: "draft",
    project: {
      projectType: "short_drama",
      userIdea: "都市爱情短剧：咖啡店老板与常客在雨夜重逢",
      targetDurationSec: 90,
      script: {
        title: "雨夜重逢",
        logline: "咖啡店老板与常客雨夜重逢,误会与和解",
        acts: [
          { act: 1, sceneId: "scene-1", summary: "雨夜进店", emotion: "阴郁" },
        ],
        narratorLines: ["雨还在下..."],
      },
      styleBible: {
        palette: ["#333", "#f0e7d8"],
        lightingStyle: "soft",
        aspectRatio: "9:16",
        negativePrompt: "low quality",
      },
      characters: [
        {
          id: "char-owner",
          name: "林夕",
          role: "主角",
          personalityTone: "内敛温和",
          promptAnchor: "30岁咖啡店女老板,长发,素色围裙",
          turnaroundStatus: "draft",
        },
        {
          id: "char-guest",
          name: "陈默",
          role: "配角",
          personalityTone: "沉稳",
          promptAnchor: "32岁常客,西装,疲惫眼神",
          turnaroundStatus: "draft",
        },
      ],
      scenes: [
        {
          id: "scene-1",
          name: "雨夜咖啡店",
          location: "街角咖啡店",
          atmosphere: "暖光雨夜",
          era: "现代",
          promptAnchor: "暖光咖啡店,玻璃上雨滴,暖色吊灯",
          turnaroundStatus: "draft",
        },
      ],
      shots: [], // 故意为空, 避免 showShotTimeline 替换 InfiniteCanvas
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function openStudioWithDramaDraft(
  page: Page,
  request: APIRequestContext,
  token: string,
  sessionId: string,
) {
  const draftProject = buildDramaDraftProject(sessionId);

  // 用 addInitScript 在每个页面加载前注入 token + 跳过 coach,
  // 避免 / 页面触发 fetchUser → setToken(null) 把 token 清掉的问题
  await page.addInitScript(
    ({ t }: { t: string }) => {
      localStorage.setItem("aimarket_token", t);
      localStorage.setItem("aimarket_studio_coach_v2", "1");
      localStorage.setItem("aimarket_studio_mobile_coach_v1", "1");
      localStorage.setItem("aimarket_studio_dock_mode_v1", "expanded");
      // 注意: 不设置 aimarket_canvas_flow=0 — 我们要测生产路径
    },
    { t: token },
  );

  await page.route(
    `**/api/v1/drama/sessions/${sessionId}/state`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            dramaRun: null,
            draftProject,
            planRun: null,
          },
        }),
      });
    },
  );

  const stateResponse = page.waitForResponse(
    (res) =>
      res.url().includes(`/api/v1/drama/sessions/${sessionId}/state`) &&
      res.ok(),
    { timeout: 30_000 },
  );

  await page.goto(
    `/studio?mode=production&sessionId=${sessionId}`,
    { waitUntil: "domcontentloaded" },
  );
  await stateResponse;
  await expect(page).toHaveURL(/sessionId=/, { timeout: 30_000 });
  // 等待创作 Dock 就绪 (drama 生产模式)
  const station = page.locator('[aria-label="创作 Dock"]');
  await expect(station).toBeVisible({ timeout: 15_000 });
}

test.describe("drama canvas (InfiniteCanvas 生产路径)", () => {
  test("drama 节点渲染 + DramaPropertyPanel 双击可打开", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);

    const { token, sessionId } = await registerAndEnsureSession(
      request,
      "drama_cv",
    );
    await openStudioWithDramaDraft(page, request, token, sessionId);

    // 1) Drama 节点在 InfiniteCanvas 上渲染 — 走 data-node-id 选择器
    const scriptNode = page.locator('[data-node-id="drama-script"]');
    await expect(scriptNode).toBeVisible({ timeout: 30_000 });
    const charNode = page.locator('[data-node-id="drama-char-char-owner"]');
    await expect(charNode).toBeVisible({ timeout: 15_000 });
    const sceneNode = page.locator('[data-node-id="drama-scene-scene-1"]');
    await expect(sceneNode).toBeVisible({ timeout: 15_000 });

    // 2) 双击 script 节点 → DramaPropertyPanel 打开
    await scriptNode.dblclick();
    const panel = page.getByTestId("drama-property-panel");
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(panel).toHaveAttribute("data-drama-node-type", "script");

    // 3) 关闭面板后, 双击 character 节点切换 panel 内容
    await panel.getByRole("button", { name: "关闭面板" }).click();
    await expect(panel).toBeHidden({ timeout: 5_000 });

    await charNode.dblclick();
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(panel).toHaveAttribute("data-drama-node-type", "character");
  });

  test("drama 节点右键菜单可用 (脚本/分镜工具)", async ({ page, request }) => {
    test.setTimeout(120_000);

    const { token, sessionId } = await registerAndEnsureSession(
      request,
      "drama_cv_ctx",
    );
    await openStudioWithDramaDraft(page, request, token, sessionId);

    const scriptNode = page.locator('[data-node-id="drama-script"]');
    await expect(scriptNode).toBeVisible({ timeout: 30_000 });

    // 3) 右键 script 节点弹出 InfiniteCanvasContextMenu
    await scriptNode.click({ button: "right" });
    const menu = page.locator('[data-testid="infinite-canvas-context-menu"]');
    await expect(menu).toBeVisible({ timeout: 5_000 });
  });
});
