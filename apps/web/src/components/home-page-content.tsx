"use client";

import {
  APP_LEFT_RAIL_PAD_CLASS,
  AppLeftRail,
} from "@/components/app-left-rail";
import { HomeMain } from "@/components/home-main";
import { HomePageTracker } from "@/components/home-page-tracker";
import { PromoBanner } from "@/components/promo-banner";
import { SiteFooter } from "@/components/site-footer";

/** 首页壳层：极梦式左轨导航，无顶栏 */
export function HomePageContent() {
  return (
    <div className="min-h-dvh">
      <HomePageTracker />
      <AppLeftRail variant="home" />
      <PromoBanner />
      <main className={`relative pb-28 sm:pb-32 ${APP_LEFT_RAIL_PAD_CLASS}`}>
        <HomeMain />
      </main>
      <SiteFooter className={APP_LEFT_RAIL_PAD_CLASS} />
    </div>
  );
}
