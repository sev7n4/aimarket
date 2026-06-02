import { HomeMain } from "@/components/home-main";
import { PromoBanner } from "@/components/promo-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { HomePageTracker } from "@/components/home-page-tracker";

export default function HomePage() {
  return (
    <div className="min-h-dvh max-lg:pb-[var(--home-mobile-dock-h)]">
      <HomePageTracker />
      <PromoBanner />
      <SiteHeader />
      <main className="relative">
        <HomeMain />
      </main>
      <SiteFooter />
    </div>
  );
}
