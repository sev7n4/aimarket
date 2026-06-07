import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { creditsButton } from "./auth";

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

/** 等待 Studio 登录态与会话就绪，避免上传/提交时 user 尚未注入 */
export async function waitForStudioReady(page: Page) {
  const station = studioWorkstation(page);
  await expect(station.locator("textarea").first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(creditsButton(page)).toBeVisible({ timeout: 20_000 });
  await expect(station.getByRole("button", { name: "开始生成" })).toBeEnabled({
    timeout: 15_000,
  });
}
