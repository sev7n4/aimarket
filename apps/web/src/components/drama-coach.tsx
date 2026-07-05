"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const DRAMA_COACH_STORAGE_KEY = "aimarket_drama_coach_v1";

const STEPS = [
  {
    title: "写梗概",
    body: "在底部创作栏选择 Agent 模式，输入创意梗概（人物、冲突、结局）后提交。",
  },
  {
    title: "看规划",
    body: "多 Agent 会在画布时间线生成分镜规划，可查看每步摘要并在面板中调整。",
  },
  {
    title: "确认制作",
    body: "规划完成后确认分镜与积分预估，点击「确认制作」开始出片；也可勾选「规划后直接制作」。",
  },
];

export function DramaCoach({
  active,
  onDone,
}: {
  active: boolean;
  onDone?: () => void;
}) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const storageKey = user ? `${DRAMA_COACH_STORAGE_KEY}:${user.id}` : DRAMA_COACH_STORAGE_KEY;
    if (localStorage.getItem(storageKey)) return;
    setVisible(true);
    setStep(0);
  }, [active, user]);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step >= STEPS.length - 1;

  function finish() {
    const storageKey = user ? `${DRAMA_COACH_STORAGE_KEY}:${user.id}` : DRAMA_COACH_STORAGE_KEY;
    localStorage.setItem(storageKey, "1");
    setVisible(false);
    onDone?.();
  }

  return (
    <div
      className="mb-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3"
      data-testid="drama-coach-banner"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-amber-200/80">
          AI 短剧 · 快速上手 {step + 1}/{STEPS.length}
        </span>
        <button
          type="button"
          onClick={finish}
          className="rounded-lg p-1 text-amber-200/60 hover:text-amber-100"
          aria-label="关闭短剧引导"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <h3 className="text-sm font-medium text-amber-50">{current.title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-amber-100/75">{current.body}</p>
      <div className="mt-3 flex gap-2">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="rounded-full border border-amber-500/30 px-3 py-1 text-xs text-amber-200/80"
          >
            上一步
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
          className="rounded-full bg-amber-500/90 px-3 py-1 text-xs font-medium text-white"
        >
          {isLast ? "知道了" : "下一步"}
        </button>
      </div>
    </div>
  );
}
