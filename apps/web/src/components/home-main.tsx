"use client";

import { InspirationApplyProvider } from "@/lib/inspiration-apply-context";
import { HomeCreationSection } from "@/components/home-creation-section";
import { InspirationGallery } from "@/components/inspiration-gallery";

export function HomeMain() {
  return (
    <InspirationApplyProvider>
      <HomeCreationSection />
      {/* 移动端底部固定工作台占位，避免灵感区被遮挡 */}
      <div className="h-[min(42vh,300px)] shrink-0 lg:hidden" aria-hidden />
      <InspirationGallery />
    </InspirationApplyProvider>
  );
}
