import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5 px-4 py-10 text-center text-xs text-zinc-500">
      <p className="mb-3">© {new Date().getFullYear()} AIMarket. All rights reserved.</p>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <Link href="/about" className="hover:text-zinc-300">
          关于我们
        </Link>
        <span className="text-zinc-700">|</span>
        <span>内容由 AI 生成</span>
      </div>
    </footer>
  );
}
