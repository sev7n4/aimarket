"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { BRAND_SLOGAN } from "@/lib/brand";
import { StartCreateDialog } from "@/components/start-create-dialog";
import { useAuth } from "@/lib/auth-context";

export function HeroSection() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleStartCreate() {
    if (!user) {
      document.dispatchEvent(new Event("aimarket:open-login"));
      return;
    }
    setDialogOpen(true);
  }

  return (
    <section className="relative px-4 pb-6 pt-8 text-center">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top_right,rgba(249,115,22,0.25),transparent_55%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-2xl">
        <h1 className="text-balance text-xl font-semibold leading-snug tracking-tight text-zinc-100 sm:text-2xl md:text-3xl">
          {BRAND_SLOGAN}
        </h1>
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={handleStartCreate}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-orange-500/25 transition hover:from-orange-600 hover:to-orange-500 hover:shadow-xl hover:shadow-orange-500/30 active:scale-[0.98]"
          >
            <Sparkles className="size-4" />
            <span>开始创作</span>
          </button>
        </div>
      </div>
      <StartCreateDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </section>
  );
}
