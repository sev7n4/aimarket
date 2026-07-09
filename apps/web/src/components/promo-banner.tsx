"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { dismissNotice, fetchLatestNotice } from "@/lib/api/notices";
import type { Notice } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

export function PromoBanner() {
  const router = useRouter();
  const { user } = useAuth();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    fetchLatestNotice()
      .then((n) => {
        if (n) setNotice(n);
      })
      .catch(() => setNotice(null));
  }, []);

  if (!visible || !notice) return null;

  function handleAction() {
    if (notice?.link_path === "/invite") {
      if (user) {
        router.push("/invite");
      } else {
        document.dispatchEvent(new CustomEvent("aimarket:open-login"));
      }
      return;
    }
    if (notice?.link_path) router.push(notice.link_path);
  }

  async function handleClose() {
    setVisible(false);
    if (user && notice) {
      try {
        await dismissNotice(notice.id);
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div className="relative border-b border-amber-500/20 bg-gradient-to-r from-amber-950/80 via-stone-900 to-stone-950 px-4 py-2 text-center text-sm text-amber-100/90">
      <span className="font-medium">{notice.title}：</span>
      {notice.content}
      {notice.link_label ? (
        <button
          type="button"
          onClick={handleAction}
          className="ml-3 underline underline-offset-2 hover:text-white"
        >
          {notice.link_label}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => void handleClose()}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-amber-200/70 hover:bg-white/10 hover:text-white"
        aria-label="关闭公告"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
