"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AspectRatio } from "@/components/generation-settings-popover";

export interface AppliedInspiration {
  id: string;
  prompt: string;
  modelId: string;
  aspectRatio: AspectRatio;
  resolution: string;
  referenceUrls: string[];
  /** 每次 apply 递增，驱动 CreationPanel 重复灌入 */
  applyKey: number;
}

interface InspirationApplyContextValue {
  applied: AppliedInspiration | null;
  applyInspiration: (payload: Omit<AppliedInspiration, "applyKey">) => void;
  clearApplied: () => void;
}

const InspirationApplyContext = createContext<InspirationApplyContextValue | null>(
  null,
);

export function InspirationApplyProvider({ children }: { children: ReactNode }) {
  const [applied, setApplied] = useState<AppliedInspiration | null>(null);

  const applyInspiration = useCallback(
    (payload: Omit<AppliedInspiration, "applyKey">) => {
      setApplied((prev) => {
        const nextKey = (prev?.applyKey ?? 0) + 1;
        return { ...payload, applyKey: nextKey };
      });
      document.getElementById("home-creation")?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    },
    [],
  );

  const clearApplied = useCallback(() => setApplied(null), []);

  const value = useMemo(
    () => ({ applied, applyInspiration, clearApplied }),
    [applied, applyInspiration, clearApplied],
  );

  return (
    <InspirationApplyContext.Provider value={value}>
      {children}
    </InspirationApplyContext.Provider>
  );
}

export function useInspirationApply() {
  const ctx = useContext(InspirationApplyContext);
  if (!ctx) {
    throw new Error("useInspirationApply 须在 InspirationApplyProvider 内使用");
  }
  return ctx;
}
