import { test, expect } from "@playwright/test";
import { registerViaEmail } from "./helpers/auth";

test("邀请弹窗可复制邀请码与邀请链接", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await registerViaEmail(page, { emailPrefix: "copy_ui" });
  await page.goto("/invite", { waitUntil: "domcontentloaded" });

  const dialog = page.getByRole("dialog", { name: "邀请有礼" });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByRole("button", { name: "复制邀请码" })).toBeVisible({
    timeout: 15_000,
  });

  const code = (await dialog.locator(".text-3xl").textContent())?.trim();
  expect(code).toBeTruthy();

  await dialog.getByRole("button", { name: "复制邀请码" }).click();
  await expect(dialog.getByText("已复制")).toBeVisible();
  await expect
    .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(code!);

  const linkText = (await dialog.locator(".break-all").textContent())?.trim();
  expect(linkText).toContain("invite=");

  await dialog.getByRole("button", { name: "复制邀请链接" }).click();
  await expect(dialog.getByText("已复制链接")).toBeVisible();
  await expect
    .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(linkText!);
});
