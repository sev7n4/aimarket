import type { CreationDockScope, CreationLane } from "@/lib/creation-dock-prefs";
import { persistCreationLane } from "@/lib/creation-dock-prefs";
import {
  patchActiveLaneSettings,
  persistScopeLaneDrafts,
  readScopeLaneDrafts,
  switchActiveLane,
  toLaneDraft,
  type LaneSettingsDraft,
  type ScopeLaneDraftsState,
} from "@/lib/creation-lane-drafts";
import { useCallback, useEffect, useMemo, useState } from "react";

export type { LaneSettingsDraft };

export interface UseCreationLaneDraftsOptions {
  agentLaneAvailable?: boolean;
}

export function useCreationLaneDrafts(
  scope: CreationDockScope,
  options: UseCreationLaneDraftsOptions = {},
) {
  const { agentLaneAvailable = true } = options;

  const [draftState, setDraftState] = useState<ScopeLaneDraftsState>(() =>
    readScopeLaneDrafts(scope),
  );

  const creationLane = draftState.activeLane;
  const laneSettings = draftState.lanes[creationLane];

  const persist = useCallback(
    (
      next:
        | ScopeLaneDraftsState
        | ((prev: ScopeLaneDraftsState) => ScopeLaneDraftsState),
    ) => {
      setDraftState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        persistScopeLaneDrafts(scope, resolved);
        return resolved;
      });
    },
    [scope],
  );

  const setCreationLane = useCallback(
    (lane: CreationLane, settingsPatch?: Partial<LaneSettingsDraft>) => {
      persist((prev) => {
        let next = switchActiveLane(prev, lane);
        if (settingsPatch) {
          next = patchActiveLaneSettings(next, settingsPatch);
        }
        persistCreationLane(scope, lane);
        return next;
      });
    },
    [persist, scope],
  );

  const patchSettings = useCallback(
    (patch: Partial<LaneSettingsDraft>) => {
      persist((prev) => patchActiveLaneSettings(prev, patch));
    },
    [persist],
  );

  useEffect(() => {
    if (!agentLaneAvailable && creationLane === "agent") {
      setCreationLane("image");
    }
  }, [agentLaneAvailable, creationLane, setCreationLane]);

  const draft = useMemo(() => toLaneDraft(draftState), [draftState]);

  return {
    creationLane,
    setCreationLane,
    draft,
    laneSettings,
    patchSettings,
    setModelId: (modelId: string) => patchSettings({ modelId }),
    setAspectRatio: (aspectRatio: LaneSettingsDraft["aspectRatio"]) =>
      patchSettings({ aspectRatio }),
    setCount: (count: number) => patchSettings({ count }),
    setResolution: (resolution: string) => patchSettings({ resolution }),
    setOutputPrefMode: (outputPrefMode: LaneSettingsDraft["outputPrefMode"]) =>
      patchSettings({ outputPrefMode }),
    setVideoReferenceMode: (
      videoReferenceMode: LaneSettingsDraft["videoReferenceMode"],
    ) => patchSettings({ videoReferenceMode }),
    setVideoDurationSec: (
      videoDurationSec: LaneSettingsDraft["videoDurationSec"],
    ) => patchSettings({ videoDurationSec }),
    setVideoResolution: (
      videoResolution: LaneSettingsDraft["videoResolution"],
    ) => patchSettings({ videoResolution }),
  };
}
