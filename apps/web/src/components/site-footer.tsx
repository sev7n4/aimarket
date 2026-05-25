import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5 px-4 py-10 text-center text-xs text-zinc-500">
      <p className="mb-3">© {new Date().getFullYear()} AIMarket. All rights reserved.</p>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
        <Link href="/about" className="hover:text-zinc-300">
          关于我们
        </Link>
        <Link href="/faq" className="hover:text-zinc-300">
          常见问题
        </Link>
        <Link href="/privacy" className="hover:text-zinc-300">
          隐私政策
        </Link>
        <Link href="/terms" className="hover:text-zinc-300">
          服务条款
        </Link>
        <span className="text-zinc-700">|</span>
        <span>内容由 AI 生成</span>
      </div>
      <p className="mx-auto mt-4 max-w-lg leading-relaxed text-zinc-600">
        增值电信业务许可证：待补充 · 鄂ICP备XXXXXXXX号（上线前替换） ·
        网信算备XXXXXXXX号（上线前替换）
      </p>
    </footer>
  );
}
