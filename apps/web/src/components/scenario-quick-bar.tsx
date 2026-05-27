"use client";

import { useRouter } from "next/navigation";
import {
  Eraser,
  Expand,
  ImageIcon,
  ScanLine,
  ShoppingBag,
  Video,
  Wand2,
} from "lucide-react";
import type { CreationMode } from "@aimarket/ui";
import { buildStudioUrl, type StudioKind } from "@/lib/studio-navigation";

interface QuickItem {
  label: string;
  icon: typeof Expand;
  mode: CreationMode;
  prompt: string;
  toolId?: string;
  kind?: StudioKind;
}

/** 仅电商出图 + 宣传短视频相关能力 */
const items: QuickItem[] = [
  {
    label: "电商套图",
    icon: Wand2,
    mode: "ecommerce",
    kind: "project" as const,
    prompt:
      "核心卖点：轻便防水；尺寸：20cm；材质：尼龙；受众：年轻户外人群；使用场景：徒步露营",
  },
  {
    label: "白底主图",
    icon: ImageIcon,
    mode: "quick",
    prompt: "电商白底主图，商品居中，柔和顶光，高清质感",
  },
  {
    label: "抠图精修",
    icon: ScanLine,
    mode: "chat",
    prompt: "抠出商品主体，透明底或纯白底，适合主图上架",
    toolId: "cutout",
  },
  {
    label: "AI 扩图",
    icon: Expand,
    mode: "chat",
    prompt: "扩展主图边缘至详情页比例，保持商品完整",
    toolId: "expand",
  },
  {
    label: "消除杂物",
    icon: Eraser,
    mode: "chat",
    prompt: "消除商品图背景杂物，保持电商主图干净",
    toolId: "erase",
  },
  {
    label: "宣传短视频",
    icon: Video,
    mode: "chat",
    prompt:
      "基于当前商品主图，生成 15 秒产品宣传短视频：缓慢展示卖点，柔光背景，适合详情页与投放",
  },
  {
    label: "详情长图",
    icon: ShoppingBag,
    mode: "chat",
    prompt: "生成电商详情页卖点模块图，信息层次清晰，适合淘宝详情",
  },
];

interface ScenarioQuickBarProps {
  className?: string;
  /** 移动端紧凑单行 chips */
  compact?: boolean;
}

export function ScenarioQuickBar({
  className = "",
  compact = false,
}: ScenarioQuickBarProps) {
  const router = useRouter();

  function go(item: QuickItem) {
    const url = buildStudioUrl(item.kind ?? "canvas", { mode: item.mode });
    const params = new URLSearchParams(url.split("?")[1] ?? "");
    params.set("q", item.prompt);
    if (item.toolId) params.set("tool", item.toolId);
    router.push(`/studio?${params.toString()}`);
  }

  return (
    <div className={className}>
      <p
        className={`mb-2 text-zinc-600 ${compact ? "px-1 text-left text-[10px]" : "text-center text-xs"}`}
      >
        电商热门能力
      </p>
      <div
        className={`flex gap-2 pb-1 scrollbar-none ${compact ? "overflow-x-auto px-0.5" : "overflow-x-auto"}`}
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => go(item)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 transition hover:border-orange-500/30 hover:bg-white/[0.06] hover:text-zinc-200"
            >
              <Icon className="size-3.5 text-orange-400/80" />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
