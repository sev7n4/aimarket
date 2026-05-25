"use client";

import { useState } from "react";
import { ModeTabs, type CreationMode } from "@aimarket/ui";
import { modeTabs } from "@/lib/modes";
import { CreationPanel } from "@/components/creation-panel";
import { LoginDialog } from "@/components/login-dialog";
import { ScenarioQuickBar } from "@/components/scenario-quick-bar";

export function HomeCreationSection() {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [mode, setMode] = useState<CreationMode>("chat");
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <section className="relative z-10 -mt-4 px-4 pb-6">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0c] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
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
      <ScenarioQuickBar className="mx-auto mt-4 max-w-3xl" />
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </section>
  );
}
