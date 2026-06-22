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
