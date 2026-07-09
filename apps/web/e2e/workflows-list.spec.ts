import { test, expect } from "@playwright/test";
import { registerViaEmail } from "./helpers/auth";

async function skipCoach(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem("aimarket_studio_coach_v2", "1");
    localStorage.setItem("aimarket_studio_mobile_coach_v1", "1");
    localStorage.setItem("aimarket_canvas_flow", "1");
  });
}

test.describe("Workflows list page", () => {
  test.setTimeout(120_000);

  test("访问 /workflows 展示列表与新建入口", async ({ page }) => {
    await skipCoach(page);
    await registerViaEmail(page, { emailPrefix: "workflows" });
    await page.goto("/workflows");
    await expect(page.getByTestId("workflows-page")).toBeVisible();
    await expect(page.getByTestId("create-workflow-button")).toBeVisible();
    await expect(page.getByTestId("nav-workflows")).toBeVisible();
  });
});
