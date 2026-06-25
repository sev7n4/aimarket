#!/usr/bin/env node
/**
 * 生产 UI 复测：登录 → 视频参考槽位 / 灵感视频
 * PROD_EMAIL / PROD_PASSWORD / WEB_URL / SESSION_ID
 */
import { chromium } from "playwright";

const WEB = process.env.WEB_URL ?? "http://119.29.173.89:3100";
const EMAIL = process.env.PROD_EMAIL ?? "user001@163.com";
const PASSWORD = process.env.PROD_PASSWORD ?? "11111111";
const SESSION_ID =
  process.env.SESSION_ID ?? "e10ab86a-8457-465d-8329-cc01886071b3";

const results = [];
const pass = (id, d) => {
  results.push({ id, ok: true });
  console.log(`✓ ${id}: ${d}`);
};
const fail = (id, d) => {
  results.push({ id, ok: false });
  console.log(`✗ ${id}: ${d}`);
};

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
  console.log(`\n生产 UI 复测 @ ${WEB}\n`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await login(page);
    pass("UI-LOGIN", "登录成功，积分入口可见");

    await page.evaluate(() => {
      localStorage.setItem("aimarket_studio_coach_v2", "1");
      localStorage.setItem("aimarket_studio_mobile_coach_v1", "1");
      localStorage.setItem("aimarket_studio_dock_mode_v1", "expanded");
      localStorage.setItem("aimarket.studio.lane", "video");
    });
    await page.goto(`${WEB}/studio?sessionId=${SESSION_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);

    const dock = page.locator('[aria-label="创作 Dock"]');
    await dock.waitFor({ timeout: 20_000 });

    // 视频车道
    const laneBtn = dock.getByRole("button", { name: "选择创作方式" });
    const laneText = await laneBtn.textContent();
    if (!laneText?.includes("视频")) {
      await laneBtn.click();
      await page.getByRole("menuitem", { name: /视频/ }).click();
    }
    pass("UI-VIDEO-LANE", "已切到视频车道");

    // 全能参考 Sheet
    const omniTrigger = dock.getByRole("button", { name: /全能参考/ });
    await omniTrigger.click();
    await page.getByText("图/音/视参考").waitFor({ timeout: 10_000 });
    pass("UI-OMNI-SHEET", "全能参考 Sheet 已打开");

    // 首尾帧
    await page.getByRole("button", { name: /首尾帧/ }).click();
    await page.getByText("首帧").waitFor({ timeout: 10_000 });
    pass("UI-FIRST-LAST", "首尾帧槽位可见");

    // 智能多帧
    await page.getByRole("button", { name: /智能多帧/ }).click();
    await page.getByText(/镜头|运镜/).first().waitFor({ timeout: 10_000 });
    pass("UI-SMART-MULTI", "智能多帧槽位可见");

    // 画布挑选条（有素材时）
    const pickLabel = page.getByText("从画布/已上传选择");
    if (await pickLabel.isVisible().catch(() => false)) {
      const thumbs = page.locator('[aria-label^="预览"], [aria-label="选用素材"]');
      const count = await thumbs.count();
      if (count > 0) {
        pass("UI-CANVAS-PICK", `候选缩略图 ${count} 个`);
        const previewBtn = page.locator('button[title="预览"]').first();
        if (await previewBtn.isVisible().catch(() => false)) {
          await previewBtn.click();
          await page.getByRole("dialog", { name: /预览|媒体/ }).waitFor({
            timeout: 8_000,
          });
          pass("UI-THUMB-PREVIEW", "缩略图预览弹层已打开");
          await page.keyboard.press("Escape");
        }
      } else {
        fail("UI-CANVAS-PICK", "有条目但无缩略图按钮");
      }
    } else {
      fail("UI-CANVAS-PICK", "无「从画布/已上传选择」条（会话可能无画布图）");
    }

    // 灵感画廊视频
    await page.goto(`${WEB}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const inspHeading = page.getByRole("heading", { name: "灵感发现" });
    await inspHeading.scrollIntoViewIfNeeded();
    const videoCard = page
      .getByRole("button")
      .filter({ hasText: "创作者灵感" })
      .first();
    if (await videoCard.isVisible().catch(() => false)) {
      await videoCard.click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor({ timeout: 10_000 });
      const video = dialog.locator("video").first();
      if (await video.isVisible().catch(() => false)) {
        pass("UI-INSP-VIDEO", "灵感详情含 video 元素");
        await video.click();
        const played = await video.evaluate((el) => !el.paused || el.readyState >= 2);
        if (played) pass("UI-INSP-PLAY", "点击后 video 可播放/已加载");
        else fail("UI-INSP-PLAY", "video 未进入播放或加载态");
      } else {
        const unavailable = dialog.getByText(/预览不可用|无法播放/);
        if (await unavailable.isVisible().catch(() => false)) {
          fail("UI-INSP-VIDEO", "历史坏链，显示不可用占位（预期内）");
        } else {
          fail("UI-INSP-VIDEO", "详情无 video 也无占位文案");
        }
      }
      await page.getByRole("button", { name: "关闭" }).click();
    } else {
      fail("UI-INSP-VIDEO", "画廊未找到视频灵感卡片");
    }
  } catch (e) {
    fail("UI-FATAL", e instanceof Error ? e.message : String(e));
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} UI 通过`);
  process.exit(failed.length ? 1 : 0);
}

main();
