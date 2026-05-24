import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@aimarket/ui";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="打开菜单"
          >
            <Menu className="size-5" />
          </button>
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-purple-600 text-sm font-bold text-white">
              AM
            </span>
            <span>AIMarket</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="hidden sm:inline-flex">
            登录
          </Button>
          <Button variant="primary">免费开始</Button>
        </div>
      </div>
    </header>
  );
}
