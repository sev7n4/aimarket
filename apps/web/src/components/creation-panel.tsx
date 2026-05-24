"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ArrowUp,
  ChevronDown,
  ImagePlus,
  Sparkles,
} from "lucide-react";
import {
  Button,
  GlassPanel,
  ModeTabs,
  type CreationMode,
} from "@aimarket/ui";
import { modeTabs, placeholders } from "@/lib/modes";

const ecommerceTags = ["淘宝", "中国", "中文"] as const;

interface CreationPanelProps {
  initialMode?: CreationMode;
  initialPrompt?: string;
  compact?: boolean;
}

export function CreationPanel({
  initialMode = "chat",
  initialPrompt = "",
  compact = false,
}: CreationPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<CreationMode>(initialMode);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [brand, setBrand] = useState("");

  function handleSubmit() {
    const sessionId = crypto.randomUUID();
    const params = new URLSearchParams({
      sessionId,
      mode,
    });
    if (prompt.trim()) params.set("q", prompt.trim());
    router.push(`/studio?${params.toString()}`);
  }

  return (
    <GlassPanel
      className={`mx-auto w-full max-w-3xl p-4 sm:p-5 ${compact ? "" : "shadow-orange-500/5"}`}
    >
      <div className="mb-4 flex justify-center overflow-x-auto">
        <ModeTabs items={modeTabs} value={mode} onChange={setMode} />
      </div>

      {mode === "ecommerce" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <UploadSlot label="产品图" />
            <UploadSlot label="参考图" />
          </div>
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="品牌名（可选）"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-orange-500/50"
          />
          <div className="flex flex-wrap gap-2">
            {ecommerceTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholders[mode]}
          rows={mode === "ecommerce" ? 4 : 2}
          className="w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-purple-500/40"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
            aria-label="上传图片"
          >
            <ImagePlus className="size-4" />
          </button>
          <Pill>
            全能图片 V2
            <ChevronDown className="size-3 opacity-60" />
          </Pill>
          <Pill>
            1 张
            <ChevronDown className="size-3 opacity-60" />
          </Pill>
          <Pill>
            <Sparkles className="size-3 text-orange-400" />
            智能 · 1K
          </Pill>
        </div>
        <Button
          variant="primary"
          className="size-10 rounded-full p-0"
          onClick={handleSubmit}
          aria-label="开始生成"
        >
          <ArrowUp className="size-5" />
        </Button>
      </div>
    </GlassPanel>
  );
}

function UploadSlot({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/15 bg-black/30 text-xs text-zinc-400 transition hover:border-orange-500/40 hover:bg-white/5"
    >
      <ImagePlus className="size-5" />
      {label}
    </button>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300">
      {children}
    </span>
  );
}
