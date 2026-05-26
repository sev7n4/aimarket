"use client";

import { InspirationApplyProvider } from "@/lib/inspiration-apply-context";
import { HomeCreationSection } from "@/components/home-creation-section";
import { InspirationGallery } from "@/components/inspiration-gallery";

export function HomeMain() {
  return (
    <InspirationApplyProvider>
      <HomeCreationSection />
      <InspirationGallery />
    </InspirationApplyProvider>
  );
}
