"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/api/studio";

/** Sprint 7：首页匿名 PV */
export function HomePageTracker() {
  useEffect(() => {
    void trackEvent("page_view", { page: "home" }, { auth: false });
  }, []);
  return null;
}
