import { Hono } from "hono";
import { APP_VERSION } from "../lib/app-version.js";

export const versionPublic = new Hono();

versionPublic.get("/latestVersion", (c) =>
  c.json({
    data: {
      version: APP_VERSION,
      label: "稳定版 0.01",
      changelog: [
        "滚动画布批次 AI 工具链与图片操作栏",
        "精修模式：胶片条、Before/After 对比、job 完成自动切图",
        "焦点编辑与局改/电商任务解耦",
        "首页灵感扇形与移动端做同款弹层优化",
      ],
      forceUpdate: false,
    },
  }),
);
