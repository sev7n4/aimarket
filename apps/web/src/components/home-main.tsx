"use client";

import { HomeCreationSection } from "@/components/home-creation-section";
import { InspirationGallery } from "@/components/inspiration-gallery";

export function HomeMain() {
  return (
    <>
      <HomeCreationSection />
      {/* 移动端底部固定创作 dock 占位（高度随 dock + 热门能力区） */}
      <div
        className="shrink-0 lg:hidden"
        style={{ height: "min(48vh, 340px)" }}
        aria-hidden
      />
      <InspirationGallery />
    </>
  );
}
