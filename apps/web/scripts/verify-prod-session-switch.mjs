#!/usr/bin/env node
/**
 * 生产复测：个人空间侧栏切换画布（含 Agent 车道保持）
 * 在 apps/web 下执行：node scripts/verify-prod-session-switch.mjs
 */
import { chromium } from "@playwright/test";

const WEB = process.env.WEB_URL ?? "http://119.29.173.89:3100";
const EMAIL = process.env.PROD_EMAIL ?? "user001@163.com";
const PASSWORD = process.env.PROD_PASSWORD ?? "11111111";

async function login(page) {
  await page.goto(`${WEB}/studio`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const credits = page.getByRole("button", { name: /\d+\s*积分|积分\s*\d+/ });
  if (await credits.isVisible().catch(() => false)) return;

  const loginEntry =
    (await page
      .getByRole("button", { name: "登录后开始创作" })
      .isVisible()
      .catch(() => false))
      ? page.getByRole("button", { name: "登录后开始创作" })
      : page.getByRole("button", { name: "登录" }).first();
  await loginEntry.click();
  await page.getByRole("heading", { name: "登录" }).waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: "邮箱" }).click();
  await page.getByPlaceholder("邮箱").fill(EMAIL);
  await page.getByPlaceholder("密码").fill(PASSWORD);
  await page.locator("form").getByRole("button", { name: "登录" }).click();
  await credits.waitFor({ timeout: 25_000 });
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

    const rows = page.locator('[data-testid^="studio-session-row-"]');
    const count = await rows.count();
    console.log(`侧栏画布行数: ${count}`);
    if (count < 2) {
      throw new Error("个人空间侧栏少于 2 个画布，无法测试切换");
    }

    const urlBefore = page.url();
    const id0 = (await rows.nth(0).getAttribute("data-testid"))?.replace(
      "studio-session-row-",
      "",
    );
    const id1 = (await rows.nth(1).getAttribute("data-testid"))?.replace(
      "studio-session-row-",
      "",
    );
    console.log(`当前 URL: ${urlBefore}`);
    console.log(`行0 sessionId=${id0}`);
    console.log(`行1 sessionId=${id1}`);

    const targetIdx = urlBefore.includes(id0) ? 1 : 0;
    const targetId = targetIdx === 0 ? id0 : id1;
    console.log(`点击切换到 sessionId=${targetId}`);

    await rows.nth(targetIdx).click();
    await page.waitForTimeout(3000);

    const urlAfter = page.url();
    console.log(`点击后 URL: ${urlAfter}`);

    if (!urlAfter.includes(targetId)) {
      throw new Error(`URL 未更新：期望包含 ${targetId}`);
    }

    console.log("✓ 侧栏切换画布 URL 已更新");

    await page.evaluate(() => {
      localStorage.setItem("aimarket.studio.lane", "agent");
      localStorage.removeItem("aimarket.studio.laneDrafts");
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const station = page.locator('[aria-label="创作 Dock"]');
    const lanePicker = station.getByRole("button", { name: "选择创作方式" });
    await lanePicker.waitFor({ timeout: 15_000 });
    const laneText = await lanePicker.textContent();
    if (!laneText?.includes("Agent")) {
      throw new Error(`Agent 车道未保持，当前: ${laneText}`);
    }
    console.log("✓ Agent 车道已保持");

    const textarea = station.locator("textarea").first();
    await textarea.click();
    await textarea.fill("生产复测 Agent prompt，切换后应清空");
    await page.waitForTimeout(500);
    const promptBefore = await textarea.inputValue();
    if (!promptBefore.includes("生产复测")) {
      throw new Error(`Agent prompt 未写入，当前: "${promptBefore}"`);
    }
    console.log("✓ Agent 车道 prompt 已填写");

    const otherIdx = targetIdx === 0 ? 1 : 0;
    const otherId = otherIdx === 0 ? id0 : id1;
    const otherHref = await rows.nth(otherIdx).getAttribute("href");
    if (!otherHref) {
      throw new Error("侧栏行缺少 href");
    }
    await page.goto(new URL(otherHref, WEB).toString(), {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);

    if (!page.url().includes(otherId)) {
      throw new Error(`Agent 车道下切换失败，URL 未包含 ${otherId}`);
    }
    const laneAfter = await station
      .getByRole("button", { name: "选择创作方式" })
      .textContent();
    if (!laneAfter?.includes("Agent")) {
      throw new Error(`切换会话后车道变为: ${laneAfter}`);
    }
    console.log("✓ Agent 车道下切换会话仍保持 Agent 模式");

    const promptAfter = await station.locator("textarea").first().inputValue();
    if (promptAfter.trim().length > 0) {
      throw new Error(`切换会话后 prompt 未清空: "${promptAfter}"`);
    }
    const timelineCount = await page
      .getByTestId("orchestration-timeline-section")
      .count();
    if (timelineCount > 0) {
      throw new Error("切换会话后仍显示 orchestration timeline");
    }
    console.log("✓ 切换会话后 prompt 已清空且无编排时间线");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
