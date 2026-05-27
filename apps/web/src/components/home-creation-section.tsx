"use client";

import { useState } from "react";
import { CreationPanel } from "@/components/creation-panel";
import { LoginDialog } from "@/components/login-dialog";
import { ScenarioQuickBar } from "@/components/scenario-quick-bar";
import { HomeRecentSessions } from "@/components/home-recent-sessions";
import { randomUUID } from "@/lib/uuid";

interface HomeCreationSectionProps {
  onOpenInspiration?: () => void;
  inspirationCoverUrl?: string;
  inspirationOpen?: boolean;
}

export function HomeCreationSection({
  onOpenInspiration,
  inspirationCoverUrl,
  inspirationOpen,
}: HomeCreationSectionProps = {}) {
  const [sessionId] = useState(() => randomUUID());
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <section
      id="home-creation"
      className="relative z-40 px-3 pb-3 max-lg:pointer-events-none max-lg:fixed max-lg:bottom-0 max-lg:left-0 max-lg:right-0 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:scroll-mt-4 lg:px-4 lg:pb-6"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl max-lg:bg-gradient-to-t max-lg:from-black/85 max-lg:to-transparent max-lg:px-1 max-lg:pb-1 max-lg:pt-3 max-lg:backdrop-blur-sm">
        <HomeRecentSessions className="hidden px-1 pb-2 max-lg:block" />
        <CreationPanel
          variant="dock"
          showModeTabs={false}
          mode="chat"
          sessionId={sessionId}
          leadingUpload
          enablePolish
          homeDirectSubmit
          rotatingPlaceholder
          onAuthRequired={() => setLoginOpen(true)}
          onInspirationClick={onOpenInspiration}
          inspirationCoverUrl={inspirationCoverUrl}
          inspirationActive={inspirationOpen}
        />
      </div>
      <ScenarioQuickBar className="pointer-events-auto mx-auto mt-3 max-w-3xl" compact />
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </section>
  );
}
