import type { CreationDockScope } from "@/lib/creation-dock-prefs";
import type { LaneDraft } from "@/lib/creation-dock-prefs";
import {
  useCreationLaneDrafts,
  type UseCreationLaneDraftsOptions,
} from "@/hooks/use-creation-lane-drafts";

export type { LaneDraft };

export type UseCreationLaneStateOptions = UseCreationLaneDraftsOptions;

/** @deprecated 使用 useCreationLaneDrafts */
export function useCreationLaneState(
  scope: CreationDockScope,
  options: UseCreationLaneStateOptions = {},
) {
  const { creationLane, setCreationLane, draft } = useCreationLaneDrafts(
    scope,
    options,
  );
  return { creationLane, setCreationLane, draft };
}
