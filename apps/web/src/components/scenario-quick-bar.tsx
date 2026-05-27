"use client";

import { useRouter } from "next/navigation";
import {
  Eraser,
  Expand,
  ScanFace,
  Shirt,
  Sparkles,
  Type,
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

const items: QuickItem[] = [
  {
    label: "AI 扩图",
    icon: Expand,
    mode: "chat",
    prompt: "扩展画面边缘，保持主体完整，自然延伸背景",
    toolId: "expand",
  },
  {
    label: "智能消除",
    icon: Eraser,
    mode: "chat",
    prompt: "消除画面中多余物体，保持背景自然",
    toolId: "erase",
  },
  {
    label: "虚拟试衣",
    icon: Shirt,
    mode: "chat",
    prompt: "让模特穿上上传的服装，自然站姿，电商质感",
  },
  {
    label: "照片修复",
    icon: ScanFace,
    mode: "chat",
    prompt: "修复老照片划痕，自然上色，保留细节",
  },
  {
    label: "无痕改字",
    icon: Type,
    mode: "chat",
    prompt: "替换画面中的文字，保持透视与光影一致",
    toolId: "text",
  },
  {
    label: "快速出图",
    icon: Sparkles,
    mode: "quick",
    prompt: "从特写视角生成高质量商品图",
  },
  {
    label: "电商套图",
    icon: Wand2,
    mode: "ecommerce",
    kind: "project" as const,
    prompt:
      "核心卖点：轻便防水；尺寸：20cm；材质：尼龙；受众：年轻户外人群；使用场景：徒步露营",
  },
  {
    label: "视频生成",
    icon: Video,
    mode: "chat",
    prompt: "产品展示短视频，缓慢旋转，柔光背景",
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
        热门能力
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
