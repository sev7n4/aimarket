"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const [prompt, setPrompt] = useState("");
  const [dockPinned, setDockPinned] = useState(false);
  const [dockSpacerH, setDockSpacerH] = useState(0);

  const sectionRef = useRef<HTMLElement>(null);
  const dockWrapRef = useRef<HTMLDivElement>(null);

  const openLogin = useCallback((hint?: string) => {
    if (hint) setAuthHint(hint);
    setLoginOpen(true);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setDockPinned(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "0px" },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = dockWrapRef.current;
    if (!el || dockPinned) return;
    setDockSpacerH(el.offsetHeight);
  }, [dockPinned, prompt, authHint, user]);

  const creationPanel = (
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
      agentOrchestration
      agentSkills
      prompt={prompt}
      onPromptChange={setPrompt}
      initialDockExpanded={!dockPinned}
      dockLineOnly={dockPinned}
    />
  );

  return (
    <>
      <section
        ref={sectionRef}
        id="home-creation"
        className="relative z-40 scroll-mt-20 px-3 pb-3 pt-2 lg:px-4 lg:pb-6 lg:pt-0"
      >
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-3 text-balance text-center text-lg font-semibold leading-snug tracking-tight text-zinc-100 sm:text-xl">
            {BRAND_SLOGAN}
          </h1>
          {!user ? (
            <p className="mb-2 rounded-lg border border-orange-500/25 bg-orange-500/10 px-3 py-2 text-center text-xs text-orange-100/90">
              {authHint ??
                "登录后即可上传参考图并生成；也可先输入描述，提交时将引导登录"}
            </p>
          ) : null}
          <HomeRecentSessions className="hidden px-1 pb-2 max-lg:block" />
          {dockPinned ? (
            <div
              style={{ height: dockSpacerH }}
              className="w-full"
              aria-hidden
            />
          ) : null}
          <div
            ref={dockWrapRef}
            className={
              dockPinned
                ? "pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] sm:px-4"
                : "w-full"
            }
            data-home-floating-dock={dockPinned ? "true" : undefined}
            aria-label={dockPinned ? "首页底部创作台" : undefined}
          >
            <div
              className={
                dockPinned
                  ? "pointer-events-auto w-full max-w-3xl drop-shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
                  : "w-full"
              }
            >
              {creationPanel}
            </div>
          </div>
        </div>
        {!dockPinned ? (
          <ScenarioQuickBar className="pointer-events-auto mx-auto mt-3 max-w-3xl" compact />
        ) : null}
        <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      </section>
    </>
  );
}
