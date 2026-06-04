"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const STORAGE_KEY = "aimarket_studio_coach_v2";
const NEW_USER_COACH_WINDOW_MS = 24 * 60 * 60 * 1000;

const STEPS = [
  {
    title: "这是画布",
    body: "生成结果按时间线纵向排列。hover 图片：顶部为预览/精修/下载等，底部为 AI 工具链。",
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
  const { user, loading } = useAuth();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (loading) return;

    const storageKey = user ? `${STORAGE_KEY}:${user.id}` : STORAGE_KEY;
    if (localStorage.getItem(storageKey)) return;

    if (user && localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(storageKey, "1");
      return;
    }

    if (user) {
      const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
      const isNewUser =
        Number.isFinite(createdAt) &&
        Date.now() - createdAt <= NEW_USER_COACH_WINDOW_MS;

      if (!isNewUser) {
        localStorage.setItem(storageKey, "1");
        return;
      }
    }

    setVisible(true);
  }, [loading, user]);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step >= STEPS.length - 1;

  function finish() {
    localStorage.setItem(user ? `${STORAGE_KEY}:${user.id}` : STORAGE_KEY, "1");
    setVisible(false);
    onDone?.();
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 pb-[max(5rem,env(safe-area-inset-bottom))] sm:items-center sm:pb-4">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-white/10 bg-[#121212] p-4 shadow-2xl">
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
