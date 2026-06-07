import type { CreationDockScope, CreationLane } from "@/lib/creation-dock-prefs";
import {
  defaultCreationLaneForScope,
  persistCreationLane,
  readStoredCreationLane,
  type LaneDraft,
} from "@/lib/creation-dock-prefs";
import { useCallback, useEffect, useMemo, useState } from "react";

export type { LaneDraft };

export interface UseCreationLaneStateOptions {
  /** Agent 车道不可用时自动回落图片车道 */
  agentLaneAvailable?: boolean;
}

export function useCreationLaneState(
  scope: CreationDockScope,
  options: UseCreationLaneStateOptions = {},
) {
  const { agentLaneAvailable = true } = options;
  const fallback = defaultCreationLaneForScope(scope);

  const [creationLane, setCreationLaneState] = useState<CreationLane>(() =>
    readStoredCreationLane(scope, fallback),
  );

  const setCreationLane = useCallback(
    (lane: CreationLane) => {
      setCreationLaneState(lane);
      persistCreationLane(scope, lane);
    },
    [scope],
  );

  useEffect(() => {
    if (!agentLaneAvailable && creationLane === "agent") {
      setCreationLane("image");
    }
  }, [agentLaneAvailable, creationLane, setCreationLane]);

  const draft = useMemo<LaneDraft>(() => ({ lane: creationLane }), [creationLane]);

  return {
    creationLane,
    setCreationLane,
    draft,
  };
}
