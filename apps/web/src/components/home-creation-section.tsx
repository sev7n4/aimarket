"use client";

import { useCallback, useState } from "react";
import { CreationPanel } from "@/components/creation-panel";
import { LoginDialog } from "@/components/login-dialog";
import { ScenarioQuickBar } from "@/components/scenario-quick-bar";
import { HomeRecentSessions } from "@/components/home-recent-sessions";
import { useAuth } from "@/lib/auth-context";
import { BRAND_SLOGAN } from "@/lib/brand";
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
  const { user } = useAuth();
  const [sessionId] = useState(() => randomUUID());
  const [loginOpen, setLoginOpen] = useState(false);
  const [authHint, setAuthHint] = useState<string | null>(null);

  const openLogin = useCallback((hint?: string) => {
    if (hint) setAuthHint(hint);
    setLoginOpen(true);
  }, []);

  return (
    <section
      id="home-creation"
      className="relative z-50 scroll-mt-20 px-3 pb-3 pt-2 max-lg:sticky max-lg:bottom-0 max-lg:border-t max-lg:border-white/10 max-lg:bg-gradient-to-t max-lg:from-[#030303] max-lg:via-[#030303]/95 max-lg:to-transparent max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:pt-3 lg:px-4 lg:pb-6 lg:pt-0"
    >
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-3 text-balance text-center text-lg font-semibold leading-snug tracking-tight text-zinc-100 sm:text-xl">
          {BRAND_SLOGAN}
        </h1>
        {!user ? (
          <p className="mb-2 rounded-lg border border-orange-500/25 bg-orange-500/10 px-3 py-2 text-center text-xs text-orange-100/90">
            {authHint ?? "登录后即可上传参考图并生成；也可先输入描述，提交时将引导登录"}
          </p>
        ) : null}
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
          onAuthRequired={openLogin}
          onInteractionHint={(msg) => setAuthHint(msg)}
          submitOnEnter
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
