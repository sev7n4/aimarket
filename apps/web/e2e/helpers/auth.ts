import { expect, type Page } from "@playwright/test";

/** 注册成功后顶栏积分按钮（比 getByText 更稳，避免误匹配文案） */
export function creditsButton(page: Page) {
  return page.getByRole("button", { name: /积分\s+\d+/ });
}

/**
 * 邮箱注册并等待登录态就绪。监听 register API，便于在 CI 限流等场景下快速失败。
 */
export async function registerViaEmail(
  page: Page,
  opts?: { emailPrefix?: string },
): Promise<string> {
  const email = `${opts?.emailPrefix ?? "e2e"}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@test.local`;
  await page.goto("/");
  await page.getByRole("banner").getByRole("button", { name: "免费开始" }).click();
  await page.getByRole("button", { name: "邮箱" }).click();
  await page.getByRole("button", { name: "立即注册" }).click();
  await expect(page.getByRole("heading", { name: "注册" })).toBeVisible();

  const registerResponse = page.waitForResponse(
    (r) =>
      r.url().includes("/auth/register") && r.request().method() === "POST",
    { timeout: 20_000 },
  );

  await page.getByPlaceholder("邮箱").fill(email);
  await page.getByPlaceholder("密码").fill("testpass123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "注册" }).click();

  const res = await registerResponse;
  expect(
    res.ok(),
    `register failed (${res.status()}): ${await res.text().catch(() => "")}`,
  ).toBeTruthy();

  await expect(creditsButton(page)).toBeVisible({ timeout: 20_000 });
  return email;
}
