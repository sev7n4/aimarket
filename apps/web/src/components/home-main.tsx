"use client";

import { useCallback, useState } from "react";
import { HomeCreationSection } from "@/components/home-creation-section";
import {
  HomeScenarioFan,
  type ScenarioPickPreview,
} from "@/components/home-scenario-fan";
import { InspirationGallery } from "@/components/inspiration-gallery";

export function HomeMain() {
  const [fanExpanded, setFanExpanded] = useState(true);
  const [lastPick, setLastPick] = useState<ScenarioPickPreview | null>(null);

  const toggleFan = useCallback(() => setFanExpanded((v) => !v), []);

  return (
    <>
      <HomeScenarioFan
        expanded={fanExpanded}
        onExpandedChange={setFanExpanded}
        onPicked={setLastPick}
        lastPick={lastPick}
      />
      <HomeCreationSection
        onOpenInspiration={toggleFan}
        inspirationCoverUrl={lastPick?.coverUrl}
        inspirationOpen={fanExpanded}
      />
      <div
        className="shrink-0 lg:hidden"
        style={{ height: "min(48vh, 340px)" }}
        aria-hidden
      />
      <InspirationGallery />
    </>
  );
}
