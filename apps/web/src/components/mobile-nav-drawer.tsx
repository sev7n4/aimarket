"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { X } from "lucide-react";
import { HomeRecentSessions } from "@/components/home-recent-sessions";
import { LABELS } from "@/lib/mobile-labels";

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
}

const links = [
  { href: "/studio", label: LABELS.studioPage },
  { href: "/projects", label: "项目库" },
  { href: "/invite", label: "邀请有礼" },
  { href: "/settings", label: "品牌 Kit" },
  { href: "/about", label: "关于我们" },
  { href: "/faq", label: "常见问题" },
];

export function MobileNavDrawer({ open, onClose }: MobileNavDrawerProps) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-black/70 lg:hidden"
        aria-label="关闭菜单"
        onClick={onClose}
      />
      <nav className="fixed inset-y-0 left-0 z-[70] w-64 border-r border-white/10 bg-[#0a0a0a] p-4 lg:hidden">
        <div className="mb-6 flex items-center justify-between">
          <BrandLogo variant="mark" monogramSize="sm" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>
        <HomeRecentSessions className="mb-4" />
        <ul className="space-y-1">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={onClose}
                className="block rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-white/5 hover:text-white"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
