#!/usr/bin/env node
/**
 * 生产复测：个人空间侧栏切换画布
 * WEB_URL PROD_EMAIL PROD_PASSWORD
 */
import { chromium } from "playwright";

const WEB = process.env.WEB_URL ?? "http://119.29.173.89:3100";
const EMAIL = process.env.PROD_EMAIL ?? "user001@163.com";
const PASSWORD = process.env.PROD_PASSWORD ?? "11111111";

async function login(page) {
  await page.goto(`${WEB}/`, { waitUntil: "domcontentloaded" });
  const rail = page.getByTestId("app-left-rail");
  if (await rail.isVisible()) {
    await rail.getByRole("button", { name: "登录" }).click();
  } else {
    await page.getByRole("banner").getByRole("button", { name: "登录" }).click();
  }
  await page.getByRole("button", { name: "邮箱" }).click();
  await page.getByPlaceholder("邮箱").fill(EMAIL);
  await page.getByPlaceholder("密码").fill(PASSWORD);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page
    .getByRole("button", { name: /\d+\s*积分|积分\s*\d+/ })
    .waitFor({ timeout: 20_000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await login(page);
    await page.evaluate(() => {
      localStorage.setItem("aimarket_studio_coach_v2", "1");
      localStorage.setItem("aimarket_studio_mobile_coach_v1", "1");
      localStorage.setItem("aimarket_studio_dock_mode_v1", "expanded");
    });

    await page.goto(`${WEB}/studio`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);

    const links = page.locator('aside a[href*="/studio?sessionId="]');
    const count = await links.count();
    console.log(`侧栏画布链接数: ${count}`);
    if (count < 2) {
      throw new Error("个人空间侧栏少于 2 个画布，无法测试切换");
    }

    const urlBefore = page.url();
    const href0 = await links.nth(0).getAttribute("href");
    const href1 = await links.nth(1).getAttribute("href");
    const id0 = new URL(href0, WEB).searchParams.get("sessionId");
    const id1 = new URL(href1, WEB).searchParams.get("sessionId");
    console.log(`当前 URL: ${urlBefore}`);
    console.log(`链接0 sessionId=${id0}`);
    console.log(`链接1 sessionId=${id1}`);

    const target = urlBefore.includes(id0) ? links.nth(1) : links.nth(0);
    const targetHref = await target.getAttribute("href");
    const targetId = new URL(targetHref, WEB).searchParams.get("sessionId");
    console.log(`点击切换到 sessionId=${targetId}`);

    await target.click();
    await page.waitForTimeout(3000);

    const urlAfter = page.url();
    console.log(`点击后 URL: ${urlAfter}`);

    if (!urlAfter.includes(targetId)) {
      throw new Error(`URL 未更新：期望包含 ${targetId}`);
    }

    const activeLink = page.locator(
      `aside a[href*="sessionId=${targetId}"]`,
    );
    const cls = await activeLink.first().getAttribute("class");
    if (!cls?.includes("bg-white/10")) {
      console.warn("警告：侧栏高亮可能未更新");
    }

    console.log("✓ 侧栏切换画布 URL 已更新");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
