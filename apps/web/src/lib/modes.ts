import type { CreationMode } from "@aimarket/ui";
import { MessageSquare, ShoppingBag, Zap } from "lucide-react";
import { createElement } from "react";

export const modeTabs = [
  {
    id: "chat" as CreationMode,
    label: "对话",
    icon: createElement(MessageSquare, { className: "size-4" }),
  },
  {
    id: "quick" as CreationMode,
    label: "快速",
    icon: createElement(Zap, { className: "size-4" }),
  },
  {
    id: "ecommerce" as CreationMode,
    label: "电商套图 Agent",
    icon: createElement(ShoppingBag, { className: "size-4" }),
    badge: "new",
  },
];

export const placeholders: Record<CreationMode, string> = {
  chat: "试试输入：让照片上的人物笑起来",
  quick: "试试输入：从特写视角生成这张图片",
  ecommerce:
    "请输入详细产品信息：核心功能和卖点、尺寸规格、使用场景、目标受众、产品材质等",
};
