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

    const publishResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/inspiration/publish") &&
        res.request().method() === "POST",
      { timeout: 60_000 },
    );
    await finalPanel.getByTestId("drama-publish-inspiration").click();
    const publishRes = await publishResponse;
    expect(publishRes.ok()).toBeTruthy();
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

    const mineRes = await request.get(
      `${apiBase}/api/v1/inspiration/mine?pageSize=20`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(mineRes.ok()).toBeTruthy();
    const mineJson = (await mineRes.json()) as {
      data?: { rows?: Array<{ id: string }> };
    };
    expect(
      mineJson.data?.rows?.some((row) => row.id === inspirationId),
    ).toBeTruthy();

    const unpublishResponse = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/v1/inspiration/${inspirationId}`) &&
        res.request().method() === "DELETE",
      { timeout: 30_000 },
    );
    await finalPanel.getByTestId("drama-unpublish-inspiration").click();
    const unpublishRes = await unpublishResponse;
    expect(unpublishRes.ok()).toBeTruthy();

    const afterDetail = await request.get(
      `${apiBase}/api/v1/inspiration/${inspirationId}`,
    );
    expect(afterDetail.status()).toBe(404);

    await page.goto("/inspiration", { waitUntil: "domcontentloaded" });
  });
});
