import { Suspense } from "react";
import { HeroSection } from "@/components/hero-section";
import { HomeMain } from "@/components/home-main";
import { InviteCapture } from "@/components/invite-capture";
import { PromoBanner } from "@/components/promo-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { HomePageTracker } from "@/components/home-page-tracker";

export default function HomePage() {
  return (
    <div className="min-h-dvh">
      <HomePageTracker />
      <Suspense fallback={null}>
        <InviteCapture />
      </Suspense>
      <PromoBanner />
      <SiteHeader />
      <main className="relative">
        <HeroSection />
        <HomeMain />
      </main>
      <SiteFooter />
    </div>
  );
}
