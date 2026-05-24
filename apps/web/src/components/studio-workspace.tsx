"use client";

import {
  Crop,
  Eraser,
  Expand,
  Film,
  Layers,
  Palette,
  Pencil,
  Type,
  Wand2,
} from "lucide-react";
import { CreationPanel } from "@/components/creation-panel";
import type { CreationMode } from "@aimarket/ui";

const tools = [
  { name: "套图模式", icon: Palette },
  { name: "图片裁剪", icon: Crop },
  { name: "AI 智能消除", icon: Eraser },
  { name: "多图融合", icon: Layers },
  { name: "AI 扩图", icon: Expand },
  { name: "无痕改字", icon: Type },
  { name: "局部修改", icon: Pencil },
  { name: "视频生成", icon: Film },
] as const;

interface StudioWorkspaceProps {
  sessionId: string;
  initialMode: CreationMode;
  initialPrompt: string;
}

export function StudioWorkspace({
  sessionId,
  initialMode,
  initialPrompt,
}: StudioWorkspaceProps) {
  const isEcommerce = initialMode === "ecommerce";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 lg:flex-row">
      <aside className="hidden w-14 shrink-0 flex-col gap-2 lg:flex">
        {tools.map((tool) => (
          <button
            key={tool.name}
            type="button"
            title={tool.name}
            className="flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-400 transition hover:border-orange-500/30 hover:text-white"
          >
            <tool.icon className="size-4" />
          </button>
        ))}
      </aside>

      <div className="flex min-h-[50vh] flex-1 flex-col">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
            <span className="text-zinc-500">项目 · </span>
            <span className="font-medium">未命名</span>
            <span className="ml-2 text-xs text-zinc-600">内容由 AI 生成</span>
          </div>
          <code className="hidden truncate text-xs text-zinc-600 sm:block">
            {sessionId.slice(0, 8)}…
          </code>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
          {isEcommerce ? (
            <>
              <span className="text-4xl" aria-hidden>
                🎨
              </span>
              <h2 className="mt-4 text-2xl font-semibold">套图模式</h2>
              <p className="mt-2 max-w-md text-sm text-zinc-500">
                上传商品图，一键生成套图方案。在下方填写产品信息并提交。
              </p>
            </>
          ) : (
            <>
              <Wand2 className="size-10 text-orange-400/80" />
              <h2 className="mt-4 text-2xl font-semibold">Hi，我是 AIMarket</h2>
              <p className="mt-2 max-w-md text-sm text-zinc-500">
                上传图片或输入修改描述，支持多轮对话与 @ 引用历史生成图。
              </p>
            </>
          )}
        </div>

        <div className="mt-4">
          <CreationPanel
            compact
            initialMode={initialMode}
            initialPrompt={initialPrompt}
          />
        </div>
      </div>
    </div>
  );
}
