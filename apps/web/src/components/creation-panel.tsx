"use client";

import { forwardRef } from "react";

import { useCreationPanel } from "@/hooks/use-creation-panel";
import type { CreationPanelHandle, CreationPanelProps } from "@/components/creation-panel-types";

export type { CreationPanelHandle, CreationPanelProps } from "@/components/creation-panel-types";

export const CreationPanel = forwardRef<CreationPanelHandle, CreationPanelProps>(
  function CreationPanel(props, ref) {
    return useCreationPanel(props, ref);
  },
);
