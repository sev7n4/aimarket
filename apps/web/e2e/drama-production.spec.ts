import { expect, test } from "@playwright/test";
import {
  planAndLockCharacters,
  registerE2EUser,
} from "./helpers/drama-production";

test.describe("drama production export & publish", () => {
  test("制片完成 → 成片播放器 → 发布灵感 → 撤回", async ({
    page,
    request,
  }) => {
    test.setTimeout(360_000);

    const { apiBase, token } = await registerE2EUser(request);
    const { runId } = await planAndLockCharacters(page, request, token, apiBase);

    await expect(page.getByTestId("drama-production-timeline")).toBeVisible({
      timeout: 30_000,
    });

    await expect
      .poll(
        async () => {
          const res = await request.get(
            `${apiBase}/api/v1/drama/runs/${runId}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const json = (await res.json()) as {
            data?: { status?: string; finalVideoUrl?: string | null };
          };
          const data = json.data;
          if (data?.status === "completed" && data.finalVideoUrl) {
            return "completed";
          }
          if (data?.status === "failed") return "failed";
          if (data?.status === "waiting_confirm") return "waiting_confirm";
          return data?.status ?? "running";
        },
        { timeout: 240_000, intervals: [1000, 2000, 3000] },
      )
      .toBe("completed");

    await page.reload({ waitUntil: "domcontentloaded" });

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
    await expect(page.getByText(/AI 短剧|咖啡|重逢/i).first()).toBeVisible({
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
