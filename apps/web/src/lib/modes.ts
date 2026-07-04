import type { CreationMode } from "@aimarket/ui";
import { ImageIcon, MessageSquare, ShoppingBag } from "lucide-react";
import { createElement } from "react";

/** Agent / 生成 API 接受的 mode（制片模式映射为 chat） */
export type ApiCreationMode = "chat" | "image" | "ecommerce";

export function toApiCreationMode(mode: CreationMode): ApiCreationMode {
  if (mode === "production") return "chat";
  return mode;
}

export const modeTabs = [
  {
    id: "chat" as CreationMode,
    label: "对话",
    icon: createElement(MessageSquare, { className: "size-4" }),
  },
  {
    id: "image" as CreationMode,
    label: "图片模式",
    icon: createElement(ImageIcon, { className: "size-4" }),
  },
  {
    id: "ecommerce" as CreationMode,
    label: "电商套图 Agent",
    icon: createElement(ShoppingBag, { className: "size-4" }),
    badge: "new",
  },
];

export const placeholders: Record<CreationMode, string> = {
  chat: "试试输入：白底主图，柔和侧光，突出商品质感",
  image: "试试输入：生成淘宝主图比例的商品特写",
  ecommerce:
    "请输入详细产品信息：核心功能和卖点、尺寸规格、使用场景、目标受众、产品材质等",
  production: "描述你的短剧创意（至少 10 字），例如：都市职场逆袭、甜宠重逢",
};

/** Studio 制片模式 Dock 占位（不轮播时） */
export const PRODUCTION_DOCK_PLACEHOLDER =
  "描述你的短剧创意（至少 10 字），Agent 将自动规划剧本与分镜";

/** 节点式画布（InfiniteCanvas）模式：默认开启，可通过 localStorage 或 URL 参数关闭。
 *
 * 制片模式在开启时会做「Agent 车道 (ScrollCanvas) ↔ 节点编排 (InfiniteCanvas)」阶段分离；
 * 默认停留 Agent/Scroll，仅手动点「节点视图」进入 Infinite。关闭本开关则全程 ScrollCanvas（E2E 兼容）。
 */
export function isCanvasFlowMode(): boolean {
  if (typeof window === "undefined") return true;
  // URL 参数 ?canvasFlow=0 可关闭（兼容旧画布）
  const params = new URLSearchParams(window.location.search);
  if (params.get("canvasFlow") === "1") return true;
  if (params.get("canvasFlow") === "0") return false;
  // localStorage 显式关闭（默认开启）
  return localStorage.getItem("aimarket_canvas_flow") !== "0";
}

/** 切换节点式画布模式 */
export function setCanvasFlowMode(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("aimarket_canvas_flow", enabled ? "1" : "0");
}
