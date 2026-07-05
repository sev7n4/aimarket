#!/usr/bin/env node
/**
 * 生产环境魔术棒润色复测：覆盖多种意图场景，验证意图条件化 + 方向标签 + 多候选。
 * 在 aimarket-api 容器内运行，直连本机 API（默认 http://127.0.0.1:4000）。
 *
 *   docker exec -e API_BASE=http://127.0.0.1:4000 aimarket-api node /tmp/verify-prompt-optimize-prod.mjs
 */
const API_BASE = process.env.API_BASE ?? "http://127.0.0.1:4000";

const SCENARIOS = [
  { label: "文生图", mode: "image", intentSignal: "image-generate", prompt: "一个女孩站在樱花树下" },
  { label: "局部编辑", mode: "image", intentSignal: "image-edit", prompt: "把她的裙子换成红色" },
  { label: "扩图", mode: "image", intentSignal: "image-expand", prompt: "把画面向左右扩展，补全背景环境" },
  { label: "超清增强", mode: "image", intentSignal: "image-enhance", prompt: "把这张图变高清超清" },
  { label: "抠图", mode: "image", intentSignal: "image-cutout", prompt: "把人物抠出来，去掉背景" },
  { label: "消除", mode: "image", intentSignal: "image-erase", prompt: "去掉背景里的路人" },
  { label: "文字编辑", mode: "image", intentSignal: "image-text", prompt: "把招牌上的字改成开业大吉" },
  { label: "变体", mode: "image", intentSignal: "image-variation", prompt: "生成风格类似的变体" },
  { label: "文生视频", mode: "image", intentSignal: "video-generate", prompt: "生成一段城市夜景延时视频" },
  { label: "图生视频", mode: "image", intentSignal: "video-from-image", prompt: "让照片里的人物微笑并眨眼，做成视频" },
  { label: "电商主图", mode: "ecommerce", intentSignal: undefined, prompt: "白色运动鞋产品主图" },
];

async function main() {
  const email = `wandverify+${Date.now()}@example.com`;
  const regRes = await fetch(`${API_BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Passw0rd!", nickname: "wandverify" }),
  });
  const regJson = await regRes.json().catch(() => ({}));
  const token = regJson?.data?.token;
  if (!token) {
    console.error("注册失败，无法获取 token:", regRes.status, JSON.stringify(regJson).slice(0, 300));
    process.exit(1);
  }
  console.log(`注册测试用户成功：${email}\nAPI_BASE=${API_BASE}\n`);

  let llmCount = 0;
  let templateCount = 0;
  let directionMatch = 0;
  let hardFail = 0;

  for (const s of SCENARIOS) {
    const context = { creationLane: s.mode === "ecommerce" ? "image" : "image" };
    if (s.intentSignal) {
      context.intentSignal = s.intentSignal;
      context.intentConfidence = 0.8;
    }
    let body;
    try {
      const res = await fetch(`${API_BASE}/api/v1/prompt/optimize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: s.prompt, mode: s.mode, context }),
      });
      body = await res.json();
      if (!res.ok) {
        hardFail++;
        console.log(`\n【${s.label}】(${s.intentSignal ?? s.mode})  ❌ HTTP ${res.status}\n${JSON.stringify(body).slice(0, 300)}`);
        continue;
      }
    } catch (err) {
      hardFail++;
      console.log(`\n【${s.label}】  ❌ 请求异常: ${String(err).slice(0, 200)}`);
      continue;
    }

    const d = body?.data ?? {};
    if (d.source === "template-mock") templateCount++;
    else llmCount++;
    const expected = s.intentSignal ?? "ecommerce";
    if (d.direction === expected) directionMatch++;

    const variants = Array.isArray(d.variants) ? d.variants : [];
    console.log(
      [
        `\n【${s.label}】 输入：${s.prompt}`,
        `  意图信号: ${s.intentSignal ?? "(mode=" + s.mode + ")"}`,
        `  来源/方向: source=${d.source} · direction=${d.direction} · label=${d.directionLabel}`,
        `  润色结果: ${(d.prompt ?? "").slice(0, 220)}`,
        `  备选数: ${variants.length}${variants.length ? " · 备选1: " + variants[0].slice(0, 120) : ""}`,
      ].join("\n"),
    );
  }

  console.log(
    `\n──────── 汇总 ────────\n` +
      `场景总数: ${SCENARIOS.length}\n` +
      `LLM 生成: ${llmCount} · 模板兜底: ${templateCount}\n` +
      `方向匹配: ${directionMatch}/${SCENARIOS.length}\n` +
      `硬失败: ${hardFail}`,
  );

  if (hardFail > 0) {
    console.error("\n存在硬失败（HTTP/异常），复测未通过。");
    process.exit(1);
  }
  if (templateCount === SCENARIOS.length) {
    console.error("\n全部回落模板润色：生产可能未配置 prompt-optimize 的 LLM provider（DASHSCOPE/OPENAI）。");
    process.exit(2);
  }
  console.log("\n复测通过 ✓");
}

main().catch((err) => {
  console.error("复测脚本异常:", err);
  process.exit(1);
});
