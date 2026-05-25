"use client";

import { useEffect, useState } from "react";
import type { CreationMode } from "@aimarket/ui";
import {
  formatRotatingPlaceholder,
  rotatingHints,
} from "@/lib/rotating-placeholders";

const INTERVAL_MS = 3500;

export function useRotatingPlaceholder(mode: CreationMode, paused: boolean) {
  const hints = rotatingHints[mode];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [mode]);

  useEffect(() => {
    if (paused || hints.length <= 1) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % hints.length);
    }, INTERVAL_MS);
    return () => clearInterval(t);
  }, [mode, paused, hints.length]);

  return formatRotatingPlaceholder(mode, hints[index] ?? hints[0]);
}
