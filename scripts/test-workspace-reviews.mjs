#!/usr/bin/env node
/**
 * PROD-C06 — Workspace 审片评论集成测试
 * 覆盖：创建 review / list / 评论 / @mention / resolve / 权限隔离
 */
const API = process.env.API_URL ?? "http://localhost:4000";

async function req(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

function ok(name, pass, detail = "") {
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  return pass;
}

async function register(prefix) {
  const ts = Date.now();
  const email = `${prefix}_${ts}@test.local`;
  const reg = await req("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password: "testpass123" }),
  });
  return {
    email,
    userId: reg.json?.data?.user?.id,
    token: reg.json?.data?.token,
    H: { Authorization: `Bearer ${reg.json?.data?.token}` },
  };
}

async function main() {
  const owner = await register("review_owner");
  const member = await register("review_member");
  const outsider = await register("review_outsider");
  if (!owner.token || !member.token || !outsider.token) {
    console.error("注册失败");
    process.exit(1);
  }

  // 1) 创建团队 + 邀请 member 加入
  const teamRes = await req("/api/v1/workspaces/create", {
    method: "POST",
    headers: owner.H,
    body: JSON.stringify({ name: "审片测试团队" }),
  });
  const teamId = teamRes.json?.data?.id;
  ok("创建团队", teamRes.ok && !!teamId);

  const invite = await req(`/api/v1/workspaces/${teamId}/invites`, {
    method: "POST",
    headers: owner.H,
    body: JSON.stringify({ role: "member" }),
  });
  const code = invite.json?.data?.code;
  const join = await req("/api/v1/workspaces/join", {
    method: "POST",
    headers: member.H,
    body: JSON.stringify({ code }),
  });
  ok("成员加入团队", join.ok);

  // 2) owner 创建 project 级 review
  const createReview = await req(`/api/v1/workspaces/${teamId}/reviews`, {
    method: "POST",
    headers: owner.H,
    body: JSON.stringify({
      targetType: "project",
      title: "镜 3 节奏拖沓",
      body: "镜头停留太久，建议缩短到 3s",
    }),
  });
  const reviewId = createReview.json?.data?.id;
  ok(
    "owner 创建 review",
    createReview.ok && !!reviewId,
    createReview.json?.error?.message,
  );

  // 3) shot 级 review 缺 shotId 应 400
  const badShot = await req(`/api/v1/workspaces/${teamId}/reviews`, {
    method: "POST",
    headers: owner.H,
    body: JSON.stringify({ targetType: "shot", title: "无 shotId" }),
  });
  ok("shot 级缺 shotId 返回 400", badShot.status === 400);

  // 4) member list reviews 可见
  const memberList = await req(
    `/api/v1/workspaces/${teamId}/reviews?status=open`,
    { headers: member.H },
  );
  const memberSees = memberList.json?.data?.some((r) => r.id === reviewId);
  ok("member 看到 review", memberList.ok && memberSees);

  // 5) outsider 不能 list（403）
  const outsiderList = await req(
    `/api/v1/workspaces/${teamId}/reviews`,
    { headers: outsider.H },
  );
  ok("outsider 被 403 拒绝", outsiderList.status === 403);

  // 6) member 评论，@mention owner
  const comment = await req(
    `/api/v1/workspaces/${teamId}/reviews/${reviewId}/comments`,
    {
      method: "POST",
      headers: member.H,
      body: JSON.stringify({
        content: `@制片人 请看一下镜 3`,
        mentions: [owner.userId],
      }),
    },
  );
  const commentId = comment.json?.data?.id;
  ok(
    "member 评论 + @mention owner",
    comment.ok && !!commentId,
    comment.json?.error?.message,
  );

  // 7) @不存在的用户应 400
  const badMention = await req(
    `/api/v1/workspaces/${teamId}/reviews/${reviewId}/comments`,
    {
      method: "POST",
      headers: member.H,
      body: JSON.stringify({
        content: "测试无效 @",
        mentions: ["00000000-0000-0000-0000-000000000000"],
      }),
    },
  );
  ok("@无效用户返回 400", badMention.status === 400);

  // 8) owner list comments 看到 member 的评论
  const comments = await req(
    `/api/v1/workspaces/${teamId}/reviews/${reviewId}/comments`,
    { headers: owner.H },
  );
  const ownerSeesComment = comments.json?.data?.some(
    (c) => c.id === commentId && c.mentions?.includes(owner.userId),
  );
  ok("owner 看到 comment + mentions", comments.ok && ownerSeesComment);

  // 9) review commentCount 正确
  const reviewDetail = await req(
    `/api/v1/workspaces/${teamId}/reviews/${reviewId}`,
    { headers: owner.H },
  );
  ok(
    "review.commentCount = 1",
    reviewDetail.json?.data?.commentCount === 1,
    `actual=${reviewDetail.json?.data?.commentCount}`,
  );

  // 10) member resolve review
  const resolve = await req(
    `/api/v1/workspaces/${teamId}/reviews/${reviewId}`,
    {
      method: "PATCH",
      headers: member.H,
      body: JSON.stringify({ status: "resolved" }),
    },
  );
  ok(
    "member 标记 resolved",
    resolve.ok && resolve.json?.data?.status === "resolved",
  );
  ok(
    "resolved_by 已记录",
    resolve.json?.data?.resolvedBy === member.userId,
  );

  // 11) reopen
  const reopen = await req(
    `/api/v1/workspaces/${teamId}/reviews/${reviewId}`,
    {
      method: "PATCH",
      headers: owner.H,
      body: JSON.stringify({ status: "open" }),
    },
  );
  ok("owner 重新打开", reopen.ok && reopen.json?.data?.status === "open");

  console.log("\n=== PROD-C06 审片评论测试完成 ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
