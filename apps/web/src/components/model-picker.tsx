"use client";

import { useEffect, useState } from "react";
import { ChevronDown, KeyRound, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ImageModel } from "@/lib/types";
import { CompactDockSheet } from "@/components/compact-dock-sheet";
import {
  hasByokConfigured,
  loadByokKeys,
  saveByokKeys,
  type ByokKeys,
} from "@/lib/byok-keys";

export const AUTO_MODEL_ID = "auto";

interface ModelPickerProps {
  models: ImageModel[];
  value: string;
  onChange: (id: string) => void;
}

export function ModelPicker({ models, value, onChange }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [byok, setByok] = useState<ByokKeys>({});
  const [byokDraft, setByokDraft] = useState("");
  const [useByok, setUseByok] = useState(false);

  const list = models.length
    ? models
    : [{ id: "omni-v2", name: "全能图片 V2", type: "image" } as ImageModel];

  useEffect(() => {
    const keys = loadByokKeys();
    setByok(keys);
    setByokDraft(keys.openai ?? "");
    setUseByok(hasByokConfigured(keys));
  }, [open]);

  const label =
    value === AUTO_MODEL_ID
      ? "Auto"
      : list.find((m) => m.id === value)?.name ?? "选择模型";

  function pick(id: string) {
    onChange(id);
    setOpen(false);
  }

  function saveByok() {
    const next = { ...byok, openai: byokDraft.trim() || undefined };
    saveByokKeys(next);
    setByok(next);
    setUseByok(hasByokConfigured(next));
  }

  const imageModels = list.filter((m) => m.type === "image");
  const videoModels = list.filter((m) => m.type === "video");

  return (
    <CompactDockSheet
      open={open}
      onClose={() => setOpen(false)}
      title="模型"
      desktopWidthClass="w-64"
      trigger={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex max-w-[7.5rem] shrink-0 items-center gap-1 truncate rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/10 sm:max-w-[9rem]"
          aria-label="选择模型"
        >
          <Sparkles className="size-3 shrink-0 text-orange-400" />
          <span className="truncate">{label}</span>
          <ChevronDown
            className={`size-3 shrink-0 opacity-60 ${open ? "rotate-180" : ""}`}
          />
        </button>
      }
    >
      <button
        type="button"
        onClick={() => pick(AUTO_MODEL_ID)}
        className={`mb-2 flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition ${
          value === AUTO_MODEL_ID
            ? "border-orange-500/50 bg-orange-500/10 text-white"
            : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20"
        }`}
      >
        <span className="font-medium">Auto</span>
        <span className="text-[10px] text-zinc-500">
          根据提示词与任务自动选模型（对标 Cursor Agent）
        </span>
      </button>

      {imageModels.length > 0 ? (
        <>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            图片模型
          </p>
          <ul className="space-y-1">
            {imageModels.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => pick(m.id)}
                  className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition ${
                    value === m.id
                      ? "bg-white text-black"
                      : "text-zinc-400 hover:bg-white/10"
                  }`}
                >
                  <span className="font-medium">{m.name}</span>
                  {m.description ? (
                    <span className="mt-0.5 block text-[10px] opacity-70">
                      {m.description}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {videoModels.length > 0 ? (
        <>
          <p className="mb-1.5 mt-3 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            视频模型
          </p>
          <ul className="space-y-1">
            {videoModels.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => pick(m.id)}
                  className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition ${
                    value === m.id
                      ? "bg-white text-black"
                      : "text-zinc-400 hover:bg-white/10"
                  }`}
                >
                  <span className="font-medium">{m.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="mt-3 border-t border-white/10 pt-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs text-zinc-400">
          <KeyRound className="size-3.5" />
          BYOK（自带 API Key）
        </div>
        <label className="flex items-center gap-2 text-[11px] text-zinc-500">
          <input
            type="checkbox"
            checked={useByok}
            onChange={(e) => setUseByok(e.target.checked)}
            className="rounded border-white/20"
          />
          优先使用我配置的 Key（本地保存）
        </label>
        <input
          type="password"
          value={byokDraft}
          onChange={(e) => setByokDraft(e.target.value)}
          placeholder="OpenAI API Key（sk-…）"
          className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs outline-none focus:border-orange-500/40"
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={saveByok}
            className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-white/15"
          >
            保存 Key
          </button>
          <Link
            href="/settings"
            className="text-[11px] text-orange-400/90 hover:underline"
            onClick={() => setOpen(false)}
          >
            账户设置
          </Link>
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
          服务端 BYOK 路由即将接入；当前 Key 仅保存在本机浏览器。
        </p>
      </div>
    </CompactDockSheet>
  );
}
