"use client";

import { useEffect, useState } from "react";
import { MOBILE_BREAKPOINT } from "@/lib/breakpoints";

export function useIsMobile(breakpointPx = MOBILE_BREAKPOINT) {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [breakpointPx]);

  return mobile;
}
