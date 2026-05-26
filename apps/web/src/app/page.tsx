import { Suspense } from "react";
import { HomeCreationSection } from "@/components/home-creation-section";
import { HeroSection } from "@/components/hero-section";
import { InspirationGallery } from "@/components/inspiration-gallery";
import { InviteCapture } from "@/components/invite-capture";
import { PromoBanner } from "@/components/promo-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AppLeftRail } from "@/components/app-left-rail";
import { HomePageTracker } from "@/components/home-page-tracker";

export default function HomePage() {
  return (
    <div className="min-h-dvh md:pl-14">
      <HomePageTracker />
      <AppLeftRail />
      <Suspense fallback={null}>
        <InviteCapture />
      </Suspense>
      <PromoBanner />
      <SiteHeader />
      <main className="relative">
        <HeroSection />
        <HomeCreationSection />
        {/* 移动端底部固定工作台占位，避免灵感区被遮挡 */}
        <div className="h-[min(42vh,300px)] shrink-0 lg:hidden" aria-hidden />
        <InspirationGallery />
      </main>
      <SiteFooter />
    </div>
  );
}
