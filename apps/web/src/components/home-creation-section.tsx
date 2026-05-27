"use client";

import { useState } from "react";
import { ModeTabs, type CreationMode } from "@aimarket/ui";
import { modeTabs } from "@/lib/modes";
import { CreationPanel } from "@/components/creation-panel";
import { LoginDialog } from "@/components/login-dialog";
import { ScenarioQuickBar } from "@/components/scenario-quick-bar";
import { HomeRecentSessions } from "@/components/home-recent-sessions";
import { randomUUID } from "@/lib/uuid";

export function HomeCreationSection() {
  const [sessionId] = useState(() => randomUUID());
  const [mode, setMode] = useState<CreationMode>("chat");
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <section
      id="home-creation"
      className="relative z-40 -mt-4 px-3 pb-3 max-lg:pointer-events-none max-lg:fixed max-lg:bottom-0 max-lg:left-0 max-lg:right-0 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:scroll-mt-4 lg:px-4 lg:pb-6"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0c]/95 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-md max-lg:shadow-[0_-8px_40px_rgba(0,0,0,0.65)]">
        <HomeRecentSessions className="hidden border-b border-white/5 px-3 py-2 max-lg:block" />
        <div className="flex justify-center border-b border-white/5 px-3 py-3">
          <ModeTabs
            items={modeTabs}
            value={mode}
            onChange={setMode}
            className="max-w-full overflow-x-auto"
          />
        </div>
        <div className="px-3 py-3 sm:px-4 sm:py-4">
          <CreationPanel
            variant="dock"
            showModeTabs={false}
            mode={mode}
            onModeChange={setMode}
            sessionId={sessionId}
            leadingUpload
            enablePolish
            homeDirectSubmit
            rotatingPlaceholder
            onAuthRequired={() => setLoginOpen(true)}
          />
        </div>
      </div>
      <ScenarioQuickBar className="pointer-events-auto mx-auto mt-3 max-w-3xl" compact />
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </section>
  );
}
