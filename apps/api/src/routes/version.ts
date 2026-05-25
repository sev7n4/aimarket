import { Hono } from "hono";

export const versionPublic = new Hono();

versionPublic.get("/latestVersion", (c) =>
  c.json({
    data: {
      version: "0.4.0",
      label: "Phase 3",
      changelog: ["积分套餐与模拟充值", "每日签到", "邀请有礼", "运营公告"],
      forceUpdate: false,
    },
  }),
);
