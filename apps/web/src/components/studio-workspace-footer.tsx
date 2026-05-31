"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { StudioUserDialog } from "@/components/studio-user-dialog";
import { ModelProviderSettingsDialog } from "@/components/model-provider-settings-dialog";
import { CreditsDialog } from "@/components/credits-dialog";

interface StudioWorkspaceFooterProps {
  collapsed?: boolean;
  onLogin: () => void;
}

/**
 * 工作区侧栏底栏（对标 Cursor）：左下角账户，右下角模型接入设置。
 */
export function StudioWorkspaceFooter({
  collapsed = false,
  onLogin,
}: StudioWorkspaceFooterProps) {
  const { user, loading } = useAuth();
  const [userOpen, setUserOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);

  const initial = user?.email[0]?.toUpperCase() ?? "?";

  if (collapsed) {
    return (
      <>
        <div className="mt-auto flex w-full flex-col items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => (user ? setUserOpen(true) : onLogin())}
            className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-purple-600 text-xs font-bold text-white transition hover:ring-2 hover:ring-orange-500/40"
            title={user ? user.email : "登录"}
            aria-label={user ? "账户信息" : "登录"}
          >
            {loading ? "…" : initial}
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex size-9 items-center justify-center rounded-full border border-white/10 text-zinc-500 transition hover:bg-white/5 hover:text-white"
            title="模型接入设置"
            aria-label="模型接入设置"
          >
            <Settings className="size-4" />
          </button>
        </div>
        <FooterDialogs
          userOpen={userOpen}
          settingsOpen={settingsOpen}
          creditsOpen={creditsOpen}
          onUserClose={() => setUserOpen(false)}
          onSettingsClose={() => setSettingsOpen(false)}
          onCreditsClose={() => setCreditsOpen(false)}
          onLogin={onLogin}
          onOpenCredits={() => setCreditsOpen(true)}
        />
      </>
    );
  }

  return (
    <>
      <div className="mt-auto flex shrink-0 items-center justify-between gap-2 border-t border-white/5 pt-3">
        <button
          type="button"
          onClick={() => (user ? setUserOpen(true) : onLogin())}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-transparent px-1 py-1 text-left transition hover:border-white/10 hover:bg-white/[0.03]"
          title={user ? user.email : "登录"}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-purple-600 text-xs font-bold text-white">
            {loading ? "…" : initial}
          </span>
          <span className="min-w-0 flex-1">
            {user ? (
              <>
                <span className="block truncate text-xs font-medium text-zinc-200">
                  {user.email.split("@")[0]}
                </span>
                <span className="block text-[10px] text-zinc-600">
                  {user.credits} 积分
                </span>
              </>
            ) : (
              <>
                <span className="block text-xs font-medium text-zinc-400">
                  未登录
                </span>
                <span className="block text-[10px] text-orange-400/90">
                  点击登录
                </span>
              </>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-zinc-500 transition hover:bg-white/5 hover:text-white"
          title="模型接入设置"
          aria-label="模型接入设置"
        >
          <Settings className="size-4" />
        </button>
      </div>
      <FooterDialogs
        userOpen={userOpen}
        settingsOpen={settingsOpen}
        creditsOpen={creditsOpen}
        onUserClose={() => setUserOpen(false)}
        onSettingsClose={() => setSettingsOpen(false)}
        onCreditsClose={() => setCreditsOpen(false)}
        onLogin={onLogin}
        onOpenCredits={() => setCreditsOpen(true)}
      />
    </>
  );
}

function FooterDialogs({
  userOpen,
  settingsOpen,
  creditsOpen,
  onUserClose,
  onSettingsClose,
  onCreditsClose,
  onLogin,
  onOpenCredits,
}: {
  userOpen: boolean;
  settingsOpen: boolean;
  creditsOpen: boolean;
  onUserClose: () => void;
  onSettingsClose: () => void;
  onCreditsClose: () => void;
  onLogin: () => void;
  onOpenCredits: () => void;
}) {
  return (
    <>
      <StudioUserDialog
        open={userOpen}
        onClose={onUserClose}
        onLogin={() => {
          onUserClose();
          onLogin();
        }}
        onOpenCredits={onOpenCredits}
      />
      <ModelProviderSettingsDialog
        open={settingsOpen}
        onClose={onSettingsClose}
        onLogin={onLogin}
      />
      <CreditsDialog open={creditsOpen} onClose={onCreditsClose} />
    </>
  );
}
