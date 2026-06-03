import type { Page } from "@playwright/test";

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
