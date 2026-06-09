"use client";

import {
  APP_LEFT_RAIL_PAD_CLASS,
  AppLeftRail,
} from "@/components/app-left-rail";
import { HomeMain } from "@/components/home-main";
import { HomePageTracker } from "@/components/home-page-tracker";
import { PromoBanner } from "@/components/promo-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/** 首页壳层：桌面左轨 + 移动顶栏汉堡菜单 */
export function HomePageContent() {
  return (
    <div className="min-h-dvh">
      <HomePageTracker />
      <AppLeftRail variant="home" />
      <PromoBanner />
      <div className="lg:hidden">
        <SiteHeader />
      </div>
      <main className={`relative pb-28 sm:pb-32 ${APP_LEFT_RAIL_PAD_CLASS}`}>
        <HomeMain />
      </main>
      <SiteFooter className={APP_LEFT_RAIL_PAD_CLASS} />
    </div>
  );
}
