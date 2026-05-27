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

export interface InspirationVariable {
  key: string;
  label: string;
  default: string;
}

export interface AppliedInspiration {
  id: string;
  title: string;
  prompt: string;
  promptTemplate?: string;
  variables?: InspirationVariable[];
  modelId: string;
  aspectRatio: AspectRatio;
  resolution: string;
  referenceUrls: string[];
  /** 每次 apply 递增，驱动 CreationPanel 重复灌入 */
  applyKey: number;
  /** 是否从 fork-project 创建 */
  forkAsProject?: boolean;
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
      if (!payload.forkAsProject) {
        document.getElementById("home-creation")?.scrollIntoView({
          behavior: "smooth",
          block: window.matchMedia("(max-width: 767px)").matches
            ? "center"
            : "nearest",
        });
      }
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
    throw new Error("useInspirationApply must be used within InspirationApplyProvider");
  }
  return ctx;
}
