"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CreationPanel } from "@/components/creation-panel";
import { LoginDialog } from "@/components/login-dialog";
import { BrandSloganHeading } from "@/components/brand-slogan-heading";
import { HomeProductionEntry } from "@/components/home-production-entry";
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
  const [prompt, setPrompt] = useState("");
  const [dockPinned, setDockPinned] = useState(false);
  const [dockSpacerH, setDockSpacerH] = useState(0);

  const sectionRef = useRef<HTMLElement>(null);
  const dockWrapRef = useRef<HTMLDivElement>(null);

  const openLogin = useCallback(() => {
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
  }, [dockPinned, prompt]);

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
      submitOnEnter
      onInspirationClick={onOpenInspiration}
      inspirationCoverUrl={inspirationCoverUrl}
      inspirationActive={inspirationOpen}
      agentOrchestration
      agentSkills
      prompt={prompt}
      onPromptChange={setPrompt}
      initialDockExpanded
      dockLineOnly={false}
    />
  );

  return (
    <>
      <section
        ref={sectionRef}
        id="home-creation"
        className="relative z-40 scroll-mt-20 px-3 pb-4 pt-10 sm:pt-12 lg:px-4 lg:pb-6 lg:pt-16 xl:pt-20"
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top,rgba(168,139,235,0.16),rgba(147,112,219,0.08)_42%,transparent_68%)] sm:h-56 lg:h-64"
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl">
          <BrandSloganHeading className="mb-5 sm:mb-6" variant="production" />
          <HomeProductionEntry />
          <div className="mt-6 sm:mt-7" />
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
                ? "pointer-events-none fixed inset-x-0 bottom-0 left-0 z-50 flex justify-center px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] sm:px-4 lg:left-14"
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
        <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      </section>
    </>
  );
}
