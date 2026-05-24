import { CreationPanel } from "@/components/creation-panel";
import { HeroSection } from "@/components/hero-section";
import { InspirationGallery } from "@/components/inspiration-gallery";
import { PromoBanner } from "@/components/promo-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <div className="min-h-dvh">
      <PromoBanner />
      <SiteHeader />
      <main>
        <HeroSection />
        <div className="relative z-10 -mt-2 px-4 pb-4">
          <CreationPanel />
        </div>
        <InspirationGallery />
      </main>
      <SiteFooter />
    </div>
  );
}
