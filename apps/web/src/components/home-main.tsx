"use client";

import { useCallback, useEffect, useState } from "react";
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

  useEffect(() => {
    const onExpandKits = () => setFanExpanded(true);
    document.addEventListener("aimarket:expand-inspiration-kits", onExpandKits);
    return () =>
      document.removeEventListener(
        "aimarket:expand-inspiration-kits",
        onExpandKits,
      );
  }, []);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "inspiration-kits") {
      setFanExpanded(true);
      requestAnimationFrame(() => {
        document.getElementById("inspiration-kits")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    } else if (hash === "inspiration") {
      requestAnimationFrame(() => {
        document.getElementById("inspiration")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, []);

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
