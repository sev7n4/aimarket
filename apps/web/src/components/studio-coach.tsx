"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "aimarket_studio_coach_v2";

const STEPS = [
  {
    title: "这是画布",
    body: "生成的图片会按批次纵向排列。点击图片可选中；hover 图片底部可预览、精修或重跑。",
  },
  {
    title: "底部创作栏",
    body: "输入描述、选择模型与张数后提交生成。按 ⌘J 可收起输入栏，专注查看画布。",
  },
  {
    title: "精修与工具链",
    body: "每批下方有 AI 工具链可快速抠图、变体；点「进入精修」或选中图上的「精修此图」，进入自由画布做圈选、对比与连续迭代。",
  },
];

export function StudioCoach({ onDone }: { onDone?: () => void }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step >= STEPS.length - 1;

  function finish() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
    onDone?.();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 pb-[max(5rem,env(safe-area-inset-bottom))] sm:items-center sm:pb-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121212] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            快速上手 {step + 1}/{STEPS.length}
          </span>
          <button
            type="button"
            onClick={finish}
            className="rounded-lg p-1 text-zinc-500 hover:text-white"
            aria-label="跳过引导"
          >
            <X className="size-4" />
          </button>
        </div>
        <h3 className="text-base font-semibold text-white">{current.title}</h3>
        <p className="mt-2 text-sm text-zinc-400">{current.body}</p>
        <div className="mt-4 flex gap-2">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 rounded-full border border-white/10 py-2 text-sm text-zinc-400"
            >
              上一步
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
            className="flex-1 rounded-full bg-gradient-to-r from-orange-500 to-purple-600 py-2 text-sm font-medium text-white"
          >
            {isLast ? "开始使用" : "下一步"}
          </button>
        </div>
      </div>
    </div>
  );
}
