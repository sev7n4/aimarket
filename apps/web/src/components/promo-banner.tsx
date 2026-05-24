"use client";

import { useState } from "react";
import { X } from "lucide-react";

export function PromoBanner() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className="relative border-b border-amber-500/20 bg-gradient-to-r from-amber-950/80 via-stone-900 to-stone-950 px-4 py-2 text-center text-sm text-amber-100/90">
      <span>
        推荐官活动开启：邀请好友注册，双方各得积分奖励。
      </span>
      <button
        type="button"
        className="ml-3 underline underline-offset-2 hover:text-white"
      >
        立即查看
      </button>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-amber-200/70 hover:bg-white/10 hover:text-white"
        aria-label="关闭公告"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
