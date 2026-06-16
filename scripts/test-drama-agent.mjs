#!/usr/bin/env node
import crypto from "node:crypto";
/**
 * AI 短剧 Agent 集成测试（mock provider）
 * 用法：API 已启动且 IMAGE_PROVIDER=mock 时
 *   API_URL=http://localhost:4000 pnpm exec tsx scripts/test-drama-agent.mjs
 */
const API = process.env.API_URL ?? "http://localhost:4000";

async function request(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(globalThis.__DRAMA_TEST_TOKEN
        ? { Authorization: `Bearer ${globalThis.__DRAMA_TEST_TOKEN}` }
        : {}),
      ...init.headers,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `HTTP ${res.status} ${path}`);
  }
  return json.data ?? json;
}

async function main() {
  const email = `drama-test-${Date.now()}@example.com`;
  const reg = await request("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password: "testpass123" }),
  });
  globalThis.__DRAMA_TEST_TOKEN = reg.token;

  const sessionId = crypto.randomUUID();
  const session = await request("/api/v1/imageSession/ensure", {
    method: "POST",
    body: JSON.stringify({
      sessionId,
      mode: "chat",
      kind: "canvas",
      title: "短剧测试",
    }),
  });
  const sid = session.sessionId ?? session.id ?? sessionId;

  const planned = await request("/api/v1/drama/runs", {
    method: "POST",
    body: JSON.stringify({
      sessionId: sid,
      userIdea:
        "都市爱情短剧：咖啡店老板与常客在雨夜重逢，三分钟讲完误会与和解",
      targetDurationSec: 90,
      aspectRatio: "9:16",
      planMode: "multi_agent",
      autoProduce: false,
    }),
  });

  const project = planned.project?.project;
  if (!project?.shots?.length) {
    throw new Error("规划失败：无分镜");
  }
  const shotCount = project.shots.length;
  if (shotCount < 8 || shotCount > 15) {
    throw new Error(`分镜数异常: ${shotCount}`);
  }
  if (!project.characters?.length) {
    throw new Error("规划失败：无角色");
  }
  if (!project.script?.acts?.length) {
    throw new Error("规划失败：无场次 acts");
  }
  console.log(
    `✓ 规划成功：${shotCount} 镜，${project.characters.length} 角色，${project.script.acts.length} 幕，预估 ${planned.estimatedPoints} 分`,
  );

  const lowEst = await request(
    `/api/v1/drama/estimate?shotCount=${shotCount}&previewTier=low`,
  );
  const fullEst = await request(
    `/api/v1/drama/estimate?shotCount=${shotCount}&previewTier=full`,
  );
  if (lowEst.estimatedPoints >= fullEst.estimatedPoints) {
    throw new Error(
      `低清预估应低于高清: low=${lowEst.estimatedPoints} full=${fullEst.estimatedPoints}`,
    );
  }
  console.log(
    `✓ 档位预估：低清 ${lowEst.estimatedPoints} / 高清 ${fullEst.estimatedPoints}`,
  );

  const postEst = await request("/api/v1/drama/estimate", {
    method: "POST",
    body: JSON.stringify({ project: planned.project.project }),
  });
  if (postEst.estimatedPoints !== planned.estimatedPoints) {
    throw new Error(
      `POST 预估与规划不一致: ${postEst.estimatedPoints} vs ${planned.estimatedPoints}`,
    );
  }
  console.log(`✓ POST 项目预估：${postEst.estimatedPoints} 分`);

  const editedShots = planned.project.project.shots.slice(0, -1);
  await request(`/api/v1/drama/projects/${planned.project.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      project: { shots: editedShots },
    }),
  });
  console.log(`✓ 分镜编辑保存：${editedShots.length} 镜`);

  const run = await request(
    `/api/v1/drama/projects/${planned.project.id}/produce`,
    {
      method: "POST",
      body: JSON.stringify({
        sessionId: sid,
        confirmed: true,
      }),
    },
  );

  if (!run.id) throw new Error("创建 Run 失败");
  console.log(`✓ 制作 Run 已启动: ${run.id}`);

  const deadline = Date.now() + 120_000;
  let lastStatus = "";
  while (Date.now() < deadline) {
    const current = await request(`/api/v1/drama/runs/${run.id}`);
    if (current.status !== lastStatus) {
      console.log(`  状态: ${current.status} (step ${current.currentStepIndex})`);
      lastStatus = current.status;
    }
    if (["completed", "failed", "cancelled"].includes(current.status)) {
      if (current.status !== "completed") {
        throw new Error(`Run 失败: ${current.error ?? current.status}`);
      }
      console.log(`✓ 短剧流水线完成`);
      if (current.finalVideoUrl) {
        console.log(`  成片: ${current.finalVideoUrl}`);
      }
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("超时：短剧 Run 未在 120s 内完成");
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
