"use client";

import { forwardRef } from "react";

import {
  CreationPanel,
  type CreationPanelHandle,
  type CreationPanelProps,
} from "@/components/creation-panel";

/** 首页创作区 Dock：variant=dock，直提 + 灵感入口 */
export type HomeCreationPanelProps = Pick<
  CreationPanelProps,
  | "sessionId"
  | "onAuthRequired"
  | "onInspirationClick"
  | "inspirationCoverUrl"
  | "inspirationActive"
  | "prompt"
  | "onPromptChange"
>;

export const HomeCreationPanel = forwardRef<
  CreationPanelHandle,
  HomeCreationPanelProps
>(function HomeCreationPanel(
  {
    sessionId,
    onAuthRequired,
    onInspirationClick,
    inspirationCoverUrl,
    inspirationActive,
    prompt,
    onPromptChange,
  },
  ref,
) {
  return (
    <CreationPanel
      ref={ref}
      variant="dock"
      showModeTabs={false}
      mode="chat"
      sessionId={sessionId}
      leadingUpload
      enablePolish
      homeDirectSubmit
      rotatingPlaceholder
      onAuthRequired={onAuthRequired}
      submitOnEnter
      onInspirationClick={onInspirationClick}
      inspirationCoverUrl={inspirationCoverUrl}
      inspirationActive={inspirationActive}
      agentOrchestration
      agentSkills={false}
      prompt={prompt}
      onPromptChange={onPromptChange}
      initialDockExpanded
      dockLineOnly={false}
    />
  );
});
