import { expect, test } from "@playwright/test";
import {
  openStudioWithCompletedDramaRun,
  registerE2EUser,
} from "./helpers/drama-production";

test.describe("drama production export & publish", () => {
  test("成片播放器 → 发布灵感 → 撤回", async ({ page, request }) => {
    test.setTimeout(180_000);

    const { apiBase, token } = await registerE2EUser(request);
    await openStudioWithCompletedDramaRun(page, request, apiBase, token);

    const finalPanel = page.getByTestId("drama-final-video-panel");
    await expect(finalPanel).toBeVisible({ timeout: 30_000 });

    const studioPanel = page.getByTestId("drama-studio-panel");
    await expect(studioPanel.getByTestId("drama-final-video-hint")).toBeVisible();

    const studioUrl = page.url();

    const publishResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/inspiration/publish") &&
        res.request().method() === "POST" &&
        res.ok(),
      { timeout: 30_000 },
    );
    await finalPanel.getByTestId("drama-publish-inspiration").click();
    const publishRes = await publishResponse;
    const publishJson = (await publishRes.json()) as {
      data?: { id?: string; status?: string };
    };
    const inspirationId = publishJson.data?.id;
    expect(inspirationId).toBeTruthy();
    expect(publishJson.data?.status).toBe("published");

    await expect(
      finalPanel.getByTestId("drama-inspiration-published-badge"),
    ).toBeVisible();
    await expect(
      studioPanel.getByTestId("drama-inspiration-published-panel"),
    ).toBeVisible();

    await page.goto("/inspiration", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/E2E 短剧|咖啡|重逢/i).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.goto(studioUrl, { waitUntil: "domcontentloaded" });
    await expect(finalPanel).toBeVisible({ timeout: 30_000 });

    const unpublishResponse = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/v1/inspiration/${inspirationId}`) &&
        res.request().method() === "DELETE" &&
        res.ok(),
      { timeout: 30_000 },
    );
    await finalPanel.getByTestId("drama-unpublish-inspiration").click();
    await unpublishResponse;

    const afterDetail = await request.get(
      `${apiBase}/api/v1/inspiration/${inspirationId}`,
    );
    expect(afterDetail.status()).toBe(404);
  });
});
