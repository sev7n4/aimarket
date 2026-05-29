import type { Page } from "@playwright/test";

/** Studio 工作站（桌面侧栏；避免与移动端底栏重复 aria-label 的 strict 冲突） */
export function studioWorkstation(page: Page) {
  return page.locator('section[aria-label="工作站"]').first();
}
