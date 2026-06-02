"use client";

import { useCallback, useState } from "react";
import { HomeCreationSection } from "@/components/home-creation-section";
import {
  HomeScenarioFan,
  type ScenarioPickPreview,
} from "@/components/home-scenario-fan";
import { InspirationGallery } from "@/components/inspiration-gallery";

export function HomeMain() {
  const [fanExpanded, setFanExpanded] = useState(false);
  const [lastPick, setLastPick] = useState<ScenarioPickPreview | null>(null);

  const toggleFan = useCallback(() => setFanExpanded((v) => !v), []);

  return (
    <>
      <HomeCreationSection
        onOpenInspiration={toggleFan}
        inspirationCoverUrl={lastPick?.coverUrl}
        inspirationOpen={fanExpanded}
      />
      <HomeScenarioFan
        expanded={fanExpanded}
        onExpandedChange={setFanExpanded}
        onPicked={setLastPick}
        lastPick={lastPick}
      />
      <div id="inspiration" className="max-lg:mt-2 lg:mt-0">
        <InspirationGallery />
      </div>
    </>
  );
}
