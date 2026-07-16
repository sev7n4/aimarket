import type { CreationMode } from "@aimarket/ui";
import { ImageIcon, MessageSquare } from "lucide-react";
import { createElement } from "react";

/** Agent / 生成 API 接受的 mode */
export type ApiCreationMode = CreationMode;

export function toApiCreationMode(mode: CreationMode): ApiCreationMode {
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
];

export const placeholders: Record<CreationMode, string> = {
  chat: "试试输入：白底主图，柔和侧光，突出商品质感",
  image: "试试输入：生成淘宝主图比例的商品特写",
};

/** 节点式画布（InfiniteCanvas）模式：默认开启，可通过 localStorage 或 URL 参数关闭。 */
export function isCanvasFlowMode(): boolean {
  if (typeof window === "undefined") return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get("canvasFlow") === "1") return true;
  if (params.get("canvasFlow") === "0") return false;
  return localStorage.getItem("aimarket_canvas_flow") !== "0";
}

/** 切换节点式画布模式 */
export function setCanvasFlowMode(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("aimarket_canvas_flow", enabled ? "1" : "0");
}
