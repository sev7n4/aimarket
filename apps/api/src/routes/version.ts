import { Hono } from "hono";

export const versionPublic = new Hono();

versionPublic.get("/latestVersion", (c) =>
  c.json({
    data: {
      version: "0.6.0",
      label: "Phase 5",
      changelog: [
        "Redis/BullMQ 任务队列（可选）",
        "Checkout 支付流程（Mock / Stripe）",
        "视频 Provider 抽象（Mock / HTTP API）",
      ],
      forceUpdate: false,
    },
  }),
);
