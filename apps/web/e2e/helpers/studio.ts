import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Studio 底部创作 Dock */
export function studioWorkstation(page: Page) {
  return page.locator('[aria-label="创作 Dock"]');
}

/** 跳过 Studio 首次 coach mark，避免遮挡 E2E 点击 */
export async function skipStudioCoach(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("aimarket_studio_coach_v2", "1");
    localStorage.setItem("aimarket_studio_mobile_coach_v1", "1");
    localStorage.setItem("aimarket_studio_dock_mode_v1", "expanded");
  });
}

/** 进入 Studio 并等待客户端草稿 sessionId 与创作台就绪（空白打开不再自动 ensure） */
export async function gotoStudioAndWait(page: Page, url = "/studio") {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/sessionId=/, { timeout: 30_000 });
  const station = studioWorkstation(page);
  await expect(station.locator("textarea").first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(station.getByRole("button", { name: "开始生成" })).toBeEnabled({
    timeout: 15_000,
  });
}

/** 上传/生成前 ensure 由业务操作触发，E2E 可显式等待 */
export function waitForSessionEnsure(page: Page) {
  return page.waitForResponse(
    (res) =>
      res.url().includes("/api/v1/imageSession/ensure") &&
      res.request().method() === "POST" &&
      res.ok(),
    { timeout: 30_000 },
  );
}
