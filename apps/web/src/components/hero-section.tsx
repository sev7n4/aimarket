"use client";

import { BRAND_SLOGAN } from "@/lib/brand";

function focusHomeCreation() {
  const section = document.getElementById("home-creation");
  section?.scrollIntoView({ behavior: "smooth", block: "center" });
  const textarea = section?.querySelector("textarea");
  if (textarea instanceof HTMLTextAreaElement) {
    window.setTimeout(() => textarea.focus(), 280);
  }
}

export function HeroSection() {
  return (
    <section className="relative px-4 pb-2 pt-6 text-center lg:pb-4 lg:pt-8">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top_right,rgba(249,115,22,0.25),transparent_55%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-2xl">
        <h1 className="text-balance text-xl font-semibold leading-snug tracking-tight text-zinc-100 sm:text-2xl md:text-3xl">
          {BRAND_SLOGAN}
        </h1>
        <p className="mt-3 text-sm text-zinc-500">
          在下方输入描述或上传参考图，即可开始生成
        </p>
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={focusHomeCreation}
            className="text-sm font-medium text-orange-400 transition hover:text-orange-300 hover:underline"
          >
            跳转到创作输入区
          </button>
        </div>
      </div>
    </section>
  );
}
