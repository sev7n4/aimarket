import type { CreationMode } from "@aimarket/ui";
import { ImageIcon, MessageSquare, ShoppingBag } from "lucide-react";
import { createElement } from "react";

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
};
