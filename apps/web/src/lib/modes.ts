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

/** @deprecated InfiniteCanvas 已下线（Phase E）；恒为 false */
export function isCanvasFlowMode(): boolean {
  return false;
}

/** @deprecated InfiniteCanvas 已下线（Phase E）；无操作 */
export function setCanvasFlowMode(_enabled: boolean): void {}
