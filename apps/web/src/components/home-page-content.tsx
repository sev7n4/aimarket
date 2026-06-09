"use client";

import { useAuth } from "@/lib/auth-context";
import { AppLeftRail } from "@/components/app-left-rail";
import { HomeMain } from "@/components/home-main";
import { HomePageTracker } from "@/components/home-page-tracker";
import { PromoBanner } from "@/components/promo-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/** 首页壳层：登录用户桌面端展示轻量左轨并为主内容留白 */
export function HomePageContent() {
  const { user } = useAuth();
  const railPad = user ? "md:pl-14" : "";

  return (
    <div className="min-h-dvh">
      <HomePageTracker />
      {user ? <AppLeftRail /> : null}
      <PromoBanner />
      <SiteHeader />
      <main className={`relative pb-28 sm:pb-32 ${railPad}`}>
        <HomeMain />
      </main>
      <SiteFooter className={railPad} />
    </div>
  );
}
